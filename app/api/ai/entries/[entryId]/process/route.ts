import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { processingService } from "@/modules/processing/processing.service";
import { processEntrySchema } from "@/types/api";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId } = await context.params;
    const input = await parseJson(request, processEntrySchema);
    return processingService.processEntry(auth.userId, entryId, input);
  }, { status: 202 });
}
