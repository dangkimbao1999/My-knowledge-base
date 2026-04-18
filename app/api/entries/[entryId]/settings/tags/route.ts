import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { entriesService } from "@/modules/entries/entries.service";
import { updateTagsSchema } from "@/types/api";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId } = await context.params;
    const input = await parseJson(request, updateTagsSchema);
    return entriesService.updateTags(auth.userId, entryId, input.tags);
  });
}
