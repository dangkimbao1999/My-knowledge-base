import { routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { processingService } from "@/modules/processing/processing.service";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { entryId } = await context.params;
    return processingService.reprocessEntry(auth.userId, entryId);
  }, { status: 202 });
}
