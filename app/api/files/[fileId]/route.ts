import { routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { filesService } from "@/modules/files/files.service";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { fileId } = await context.params;
    return filesService.getFileMetadata(auth.userId, fileId);
  });
}
