import { routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { searchService } from "@/modules/search/search.service";
import { searchSchema } from "@/types/api";

export async function GET(request: Request) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const types = url.searchParams.getAll("types");

    const input = searchSchema.parse({
      q: url.searchParams.get("q"),
      limit: url.searchParams.get("limit") ?? undefined,
      visibility: url.searchParams.get("visibility") ?? undefined,
      types: types.length > 0 ? types : undefined
    });

    return searchService.unifiedSearch(auth.userId, input);
  });
}
