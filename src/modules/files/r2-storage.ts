import { createHash, createHmac } from "node:crypto";
import { ApiError } from "@/lib/api";
import { env } from "@/config/env";

type UploadObjectInput = {
  body: Uint8Array;
  contentType: string;
  fileName: string;
};

type UploadedObject = {
  key: string;
  url: string;
};

const allowedImageMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif"
]);

function normalizeFileName(fileName: string) {
  const trimmed = fileName.trim().toLowerCase();
  const normalized = trimmed
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `image-${crypto.randomUUID()}.png`;
}

function inferExtension(contentType: string) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    default:
      return "bin";
  }
}

function ensureExtension(fileName: string, contentType: string) {
  if (/\.[a-z0-9]+$/i.test(fileName)) {
    return fileName;
  }

  return `${fileName}.${inferExtension(contentType)}`;
}

function toHex(buffer: Uint8Array) {
  return Buffer.from(buffer).toString("hex");
}

function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Uint8Array | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function toAmzDate(now: Date) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function toDateStamp(amzDate: string) {
  return amzDate.slice(0, 8);
}

function encodeKeyPath(key: string) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildObjectKey(fileName: string, contentType: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeFileName = ensureExtension(normalizeFileName(fileName), contentType);

  return `${env.R2_OBJECT_PREFIX}/${year}/${month}/${crypto.randomUUID()}-${safeFileName}`;
}

function assertR2Config() {
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_BUCKET_NAME ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_PUBLIC_BASE_URL
  ) {
    throw new ApiError(
      "Cloudflare R2 is not fully configured. Set R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PUBLIC_BASE_URL."
    );
  }
}

function publicUrlForKey(key: string) {
  return `${env.R2_PUBLIC_BASE_URL!.replace(/\/+$/g, "")}/${encodeKeyPath(key)}`;
}

export function isSupportedImageMimeType(contentType: string) {
  return allowedImageMimeTypes.has(contentType);
}

export async function uploadImageToR2(input: UploadObjectInput): Promise<UploadedObject> {
  assertR2Config();

  if (!isSupportedImageMimeType(input.contentType)) {
    throw new ApiError("Unsupported image type. Use PNG, JPG, WEBP, GIF, or AVIF.");
  }

  const bodyBuffer = Buffer.from(input.body);
  const key = buildObjectKey(input.fileName, input.contentType);
  const host = `${env.R2_BUCKET_NAME}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${encodeKeyPath(key)}`;
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(amzDate);
  const payloadHash = sha256Hex(bodyBuffer);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalHeaders =
    `cache-control:public, max-age=31536000, immutable\n` +
    `content-disposition:inline; filename="${input.fileName.replaceAll('"', "")}"\n` +
    `content-type:${input.contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders =
    "cache-control;content-disposition;content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    `/${encodeKeyPath(key)}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${env.R2_SECRET_ACCESS_KEY}`, dateStamp), "auto"), "s3"),
    "aws4_request"
  );
  const signature = toHex(hmac(signingKey, stringToSign));
  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: authorizationHeader,
      "cache-control": "public, max-age=31536000, immutable",
      "content-disposition": `inline; filename="${input.fileName.replaceAll('"', "")}"`,
      "content-type": input.contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate
    },
    body: bodyBuffer
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new ApiError("Failed to upload image to Cloudflare R2.", 502, details);
  }

  return {
    key,
    url: publicUrlForKey(key)
  };
}
