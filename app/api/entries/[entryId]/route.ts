import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { entriesService } from "@/modules/entries/entries.service";
import { updateEntrySchema } from "@/types/api";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId } = await context.params;
    return entriesService.getEntryDetail(auth.userId, entryId);
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId } = await context.params;
    const input = await parseJson(request, updateEntrySchema);
    return entriesService.updateEntry(auth.userId, entryId, input);
  });
}

export async function DELETE(_: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId } = await context.params;
    return entriesService.deleteEntry(auth.userId, entryId);
  });
}
