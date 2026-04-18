import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { wikiQueryService } from "@/modules/ai/wiki-query.service";
import { queryWikiSchema } from "@/types/api";

export async function POST(request: Request) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const input = await parseJson(request, queryWikiSchema);

    return wikiQueryService.query(auth.userId, input);
  });
}
