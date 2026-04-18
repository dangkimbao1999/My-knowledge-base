import { routeHandler } from "@/lib/api";
import { blogService } from "@/modules/blog/blog.service";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  return routeHandler(async () => {
    const { slug } = await context.params;
    return blogService.getPublicPost(slug);
  });
}
