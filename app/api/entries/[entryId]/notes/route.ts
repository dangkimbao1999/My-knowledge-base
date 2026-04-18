import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { notesService } from "@/modules/notes/notes.service";
import { noteSchema } from "@/types/api";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId } = await context.params;
    return notesService.listNotes(auth.userId, entryId);
  });
}

export async function POST(request: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId } = await context.params;
    const input = await parseJson(request, noteSchema);
    return notesService.createNote(auth.userId, entryId, input);
  });
}
