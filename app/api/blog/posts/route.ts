import { routeHandler } from "@/lib/api";
import { blogService } from "@/modules/blog/blog.service";

export async function GET() {
  return routeHandler(async () => blogService.listPosts());
}
