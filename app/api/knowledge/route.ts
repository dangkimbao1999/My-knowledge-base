import { routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { knowledgeService } from "@/modules/knowledge/knowledge.service";

export async function GET() {
  return routeHandler(async () => {
    const auth = await requireAuth();
    return knowledgeService.listKnowledge(auth.userId);
  });
}
