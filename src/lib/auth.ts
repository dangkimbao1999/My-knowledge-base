import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/config/env";
import { ApiError } from "@/lib/api";

export type AuthContext = {
  userId: string;
  username: string;
};

type SessionPayload = {
  userId: string;
  username: string;
  exp: number;
};

export const SESSION_COOKIE_NAME = "sbj_session";

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", env.JWT_SECRET).update(value).digest("base64url");
}

export function createSessionToken(payload: SessionPayload) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;

    if (payload.exp <= Date.now()) {
      return null;
    }

    if (payload.userId !== env.APP_USER_ID || payload.username !== env.APP_USERNAME) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getOptionalAuth();

  if (!auth) {
    throw new ApiError("Authentication required", 401);
  }

  return auth;
}

export async function getOptionalAuth(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME);

  if (!token?.value) {
    return null;
  }

  const payload = verifySessionToken(token.value);

  if (!payload) {
    return null;
  }

  return {
    userId: payload.userId,
    username: payload.username
  };
}
