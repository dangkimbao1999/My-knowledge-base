import { routeHandler } from "@/lib/api";
import { authService } from "@/modules/auth/auth.service";

export async function POST() {
  return routeHandler(async () => authService.register());
}
