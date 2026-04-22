import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { blogService } from "@/modules/blog/blog.service";
import { pinBlogEntrySchema } from "@/types/api";

export async function POST(request: Request) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const input = await parseJson(request, pinBlogEntrySchema);
    return blogService.unpinEntry(auth.userId, input.entryId);
  });
}
