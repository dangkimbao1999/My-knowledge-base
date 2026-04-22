import { z } from "zod";
import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { blogService } from "@/modules/blog/blog.service";

const deleteBlogPostSchema = z.object({
  entryId: z.string().uuid()
});

export async function POST(request: Request) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const input = await parseJson(request, deleteBlogPostSchema);
    return blogService.deletePost(auth.userId, input.entryId);
  });
}
