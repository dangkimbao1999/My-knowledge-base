import { ok, routeHandler } from "@/lib/api";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  return routeHandler(async () => {
    const response = ok({
      loggedOut: true
    });

    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    });

    return response;
  });
}
