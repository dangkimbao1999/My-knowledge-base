import { parseJson, routeHandler } from "@/lib/api";
import { publicBlogChatService } from "@/modules/blog/public-chat.service";
import { publicBlogChatSchema } from "@/types/api";

export async function POST(request: Request) {
  return routeHandler(async () => {
    const input = await parseJson(request, publicBlogChatSchema);
    return publicBlogChatService.query(input);
  });
}
