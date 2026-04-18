import { ok, parseJson, routeHandler } from "@/lib/api";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth";
import { authService } from "@/modules/auth/auth.service";
import { loginSchema } from "@/types/api";

export async function POST(request: Request) {
  return routeHandler(async () => {
    const input = await parseJson(request, loginSchema);
    const result = await authService.login(input);
    const response = ok({
      user: result.user
    });

    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, getSessionCookieOptions());

    return response;
  });
}
