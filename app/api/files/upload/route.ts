import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { filesService } from "@/modules/files/files.service";
import { uploadPdfSchema } from "@/types/api";

export async function POST(request: Request) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const input = await parseJson(request, uploadPdfSchema);
    return filesService.uploadPdf(auth.userId, input);
  });
}
