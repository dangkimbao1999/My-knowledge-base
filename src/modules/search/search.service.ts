import type { z } from "zod";
import { retrieveWikiSources } from "@/modules/search/wiki-retrieval";
import { searchSchema } from "@/types/api";

type UnifiedSearchInput = z.infer<typeof searchSchema>;

export const searchService = {
  async unifiedSearch(userId: string, input: UnifiedSearchInput) {
    const results = await retrieveWikiSources({
      userId,
      query: input.q,
      limit: input.limit,
      visibility: input.visibility,
      types: input.types
    });

    return {
      ownerId: userId,
      query: input.q,
      filters: {
        limit: input.limit,
        visibility: input.visibility ?? null,
        types: input.types ?? []
      },
      results
    };
  }
};
