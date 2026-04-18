import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { notesService } from "@/modules/notes/notes.service";
import { noteSchema } from "@/types/api";

type RouteContext = {
  params: Promise<{ entryId: string; noteId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId, noteId } = await context.params;
    const input = await parseJson(request, noteSchema);
    return notesService.updateNote(auth.userId, entryId, noteId, input);
  });
}

export async function DELETE(_: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId, noteId } = await context.params;
    return notesService.deleteNote(auth.userId, entryId, noteId);
  });
}
