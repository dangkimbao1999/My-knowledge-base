import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { entriesService } from "@/modules/entries/entries.service";
import { updateVisibilitySchema } from "@/types/api";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId } = await context.params;
    const input = await parseJson(request, updateVisibilitySchema);
    return entriesService.updateVisibility(auth.userId, entryId, input.visibility);
  });
}
