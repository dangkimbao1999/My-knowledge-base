import { routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { entriesService } from "@/modules/entries/entries.service";

export async function GET() {
  return routeHandler(async () => {
    const auth = await requireAuth();
    return entriesService.getNavigationTree(auth.userId);
  });
}
