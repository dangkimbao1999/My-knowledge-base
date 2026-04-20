import { routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { knowledgeService } from "@/modules/knowledge/knowledge.service";

type RouteContext = {
  params: Promise<{ topicSlug: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const { topicSlug } = await context.params;
    return knowledgeService.getTopicDetail(auth.userId, topicSlug);
  });
}
