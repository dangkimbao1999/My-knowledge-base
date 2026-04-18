import { routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { authService } from "@/modules/auth/auth.service";

export async function GET() {
  return routeHandler(async () => {
    const auth = await requireAuth();
    return authService.currentUser(auth.userId);
  });
}
