import { routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { processingService } from "@/modules/processing/processing.service";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId } = await context.params;
    return processingService.getProcessingStatus(auth.userId, entryId);
  });
}
