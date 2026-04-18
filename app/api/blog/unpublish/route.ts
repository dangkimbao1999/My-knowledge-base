import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { blogService } from "@/modules/blog/blog.service";
import { z } from "zod";

const unpublishSchema = z.object({
  entryId: z.string().uuid()
});

export async function POST(request: Request) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const input = await parseJson(request, unpublishSchema);
    return blogService.unpublishEntry(auth.userId, input.entryId);
  });
}
