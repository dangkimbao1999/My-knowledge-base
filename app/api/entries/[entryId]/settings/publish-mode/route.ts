import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { entriesService } from "@/modules/entries/entries.service";
import { updatePublishModeSchema } from "@/types/api";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId } = await context.params;
    const input = await parseJson(request, updatePublishModeSchema);
    return entriesService.updatePublishMode(auth.userId, entryId, input.publishMode);
  });
}
