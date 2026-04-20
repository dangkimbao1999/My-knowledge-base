import type { Prisma } from "@/generated/prisma";
import type { z } from "zod";
import { buildSnippet, countMatches, tokenize } from "@/lib/retrieval";
import { prisma } from "@/lib/prisma";
import { retrieveWikiSources } from "@/modules/search/wiki-retrieval";
import { searchSchema } from "@/types/api";

type UnifiedSearchInput = z.infer<typeof searchSchema>;

function scoreKnowledgeItem(
  item: Prisma.AIKnowledgeItemGetPayload<{
    include: {
      entry: {
        select: {
          id: true;
          title: true;
          entryType: true;
          logicalPath: true;
          visibility: true;
        };
      };
      sourceChunk: {
        select: {
          id: true;
          chunkIndex: true;
          content: true;
          startOffset: true;
          endOffset: true;
        };
      };
    };
  }>,
  rawQuery: string,
  tokens: string[]
) {
  const title = item.title.toLowerCase();
  const content = item.content.toLowerCase();
  const chunkText = (item.sourceChunk?.content ?? "").toLowerCase();
  const entryTitle = item.entry.title.toLowerCase();
  const normalizedQuery = rawQuery.toLowerCase();

  let score = 0;

  if (title.includes(normalizedQuery)) {
    score += 22;
  }

  if (content.includes(normalizedQuery)) {
    score += 18;
  }

  if (chunkText.includes(normalizedQuery)) {
    score += 14;
  }

  if (entryTitle.includes(normalizedQuery)) {
    score += 10;
  }

  score += countMatches(title, tokens) * 7;
  score += countMatches(content, tokens) * 4;
  score += Math.min(12, countMatches(chunkText, tokens) * 2);
  score += countMatches(entryTitle, tokens) * 3;

  return score;
}

function scoreTopicLabel(
  item: {
    slug: string;
    topic: string;
  },
  rawQuery: string,
  tokens: string[]
) {
  const topic = item.topic.toLowerCase();
  const slug = item.slug.toLowerCase();
  const normalizedQuery = rawQuery.toLowerCase();

  let score = 0;

  if (topic.includes(normalizedQuery)) {
    score += 18;
  }

  if (slug.includes(normalizedQuery)) {
    score += 14;
  }

  score += countMatches(topic, tokens) * 5;
  score += countMatches(slug, tokens) * 4;

  return score;
}

async function retrieveKnowledgeResults(userId: string, query: string, limit: number) {
  const tokens = tokenize(query);
  const needles = [...new Set([query, ...tokens])];
  const items = await prisma.aIKnowledgeItem.findMany({
    where: {
      status: "active",
      entry: {
        ownerId: userId,
        archivedAt: null
      },
      OR: needles.flatMap((needle) => [
        {
          title: {
            contains: needle,
            mode: "insensitive" as const
          }
        },
        {
          content: {
            contains: needle,
            mode: "insensitive" as const
          }
        },
        {
          sourceChunk: {
            is: {
              content: {
                contains: needle,
                mode: "insensitive" as const
              }
            }
          }
        }
      ])
    },
    include: {
      entry: {
        select: {
          id: true,
          title: true,
          entryType: true,
          logicalPath: true,
          visibility: true
        }
      },
      sourceChunk: {
        select: {
          id: true,
          chunkIndex: true,
          content: true,
          startOffset: true,
          endOffset: true
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 60
  });

  return items
    .map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      entry: item.entry,
      sourceChunk: item.sourceChunk
        ? {
            id: item.sourceChunk.id,
            chunkIndex: item.sourceChunk.chunkIndex,
            startOffset: item.sourceChunk.startOffset,
            endOffset: item.sourceChunk.endOffset,
            snippet: buildSnippet(item.sourceChunk.content, tokens)
          }
        : null,
      score: scoreKnowledgeItem(item, query, tokens)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

async function retrieveClaimResults(userId: string, query: string, limit: number) {
  const tokens = tokenize(query);
  const needles = [...new Set([query, ...tokens])];
  const items = await prisma.knowledgeClaim.findMany({
    where: {
      status: "active",
      ownerId: userId,
      OR: needles.flatMap((needle) => [
        {
          content: {
            contains: needle,
            mode: "insensitive" as const
          }
        },
        {
          claimEntities: {
            some: {
              entity: {
                is: {
                  OR: [
                    {
                      name: {
                        contains: needle,
                        mode: "insensitive" as const
                      }
                    },
                    {
                      slug: {
                        contains: needle,
                        mode: "insensitive" as const
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      ])
    },
    include: {
      entry: {
        select: {
          id: true,
          title: true,
          entryType: true,
          logicalPath: true,
          visibility: true
        }
      },
      sourceChunk: {
        select: {
          id: true,
          chunkIndex: true,
          content: true,
          startOffset: true,
          endOffset: true
        }
      },
      claimEntities: {
        include: {
          entity: {
            select: {
              id: true,
              name: true,
              slug: true,
              entityType: true
            }
          }
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 80
  });

  return items
    .map((item) => {
      const entityText = item.claimEntities
        .map((claimEntity) => `${claimEntity.entity.name} ${claimEntity.entity.slug}`)
        .join(" ");
      const rawQuery = query.toLowerCase();
      const claimText = item.content.toLowerCase();
      let score = 0;

      if (claimText.includes(rawQuery)) {
        score += 20;
      }

      score += countMatches(claimText, tokens) * 5;
      score += countMatches(entityText.toLowerCase(), tokens) * 4;
      score += countMatches(item.entry.title.toLowerCase(), tokens) * 3;

      return {
        id: item.id,
        claimType: item.claimType,
        content: item.content,
        entities: item.claimEntities.map((claimEntity) => ({
          id: claimEntity.entity.id,
          name: claimEntity.entity.name,
          slug: claimEntity.entity.slug,
          entityType: claimEntity.entity.entityType
        })),
        entry: item.entry,
        sourceChunk: item.sourceChunk
          ? {
              id: item.sourceChunk.id,
              chunkIndex: item.sourceChunk.chunkIndex,
              startOffset: item.sourceChunk.startOffset,
              endOffset: item.sourceChunk.endOffset,
              snippet: buildSnippet(item.sourceChunk.content, tokens)
            }
          : null,
        score
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

async function retrieveEntityResults(userId: string, query: string, limit: number) {
  const tokens = tokenize(query);
  const needles = [...new Set([query, ...tokens])];
  const entities = await prisma.entity.findMany({
    where: {
      ownerId: userId,
      OR: needles.flatMap((needle) => [
        {
          name: {
            contains: needle,
            mode: "insensitive" as const
          }
        },
        {
          slug: {
            contains: needle,
            mode: "insensitive" as const
          }
        }
      ])
    },
    include: {
      _count: {
        select: {
          claimEntities: true
        }
      }
    },
    take: 60
  });

  return entities
    .map((entity) => {
      const rawQuery = query.toLowerCase();
      const name = entity.name.toLowerCase();
      const slug = entity.slug.toLowerCase();
      let score = 0;

      if (name.includes(rawQuery)) {
        score += 18;
      }

      if (slug.includes(rawQuery)) {
        score += 12;
      }

      score += countMatches(name, tokens) * 5;
      score += countMatches(slug, tokens) * 4;
      score += Math.min(6, entity._count.claimEntities);

      return {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        entityType: entity.entityType,
        claimCount: entity._count.claimEntities,
        score
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

async function retrieveTopicResults(userId: string, query: string, limit: number) {
  const tokens = tokenize(query);
  const needles = [...new Set([query, ...tokens])];
  const topicRows = await prisma.aITopic.findMany({
    where: {
      status: "active",
      entry: {
        ownerId: userId,
        archivedAt: null
      },
      OR: needles.flatMap((needle) => [
        {
          topic: {
            contains: needle,
            mode: "insensitive" as const
          }
        },
        {
          slug: {
            contains: needle,
            mode: "insensitive" as const
          }
        }
      ])
    },
    select: {
      slug: true,
      topic: true,
      entryId: true
    },
    take: 120
  });

  const grouped = new Map<
    string,
    {
      slug: string;
      topic: string;
      entryIds: Set<string>;
      score: number;
    }
  >();

  for (const row of topicRows) {
    const key = row.slug;
    const existing = grouped.get(key);
    const score = scoreTopicLabel(row, query, tokens);

    if (existing) {
      existing.entryIds.add(row.entryId);
      existing.score = Math.max(existing.score, score) + 1;
      continue;
    }

    grouped.set(key, {
      slug: row.slug,
      topic: row.topic,
      entryIds: new Set([row.entryId]),
      score
    });
  }

  return [...grouped.values()]
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => ({
      slug: item.slug,
      topic: item.topic,
      entryCount: item.entryIds.size,
      score: item.score
    }));
}

function buildEntryResults(
  chunks: Awaited<ReturnType<typeof retrieveWikiSources>>,
  knowledgeItems: Awaited<ReturnType<typeof retrieveKnowledgeResults>>
) {
  const byEntry = new Map<
    string,
    {
      entryId: string;
      title: string;
      entryType: string;
      logicalPath: string | null;
      visibility: string;
      excerpt: string | null;
      blogSlug: string | null;
      updatedAt: string;
      bestScore: number;
      matchingChunks: number;
      chunkSnippets: string[];
      evidenceTitles: string[];
      tags: string[];
    }
  >();

  for (const chunk of chunks) {
    const existing = byEntry.get(chunk.entryId);

    if (existing) {
      existing.bestScore = Math.max(existing.bestScore, chunk.score);
      existing.matchingChunks += 1;
      if (existing.chunkSnippets.length < 3) {
        existing.chunkSnippets.push(chunk.snippet);
      }
      for (const item of chunk.evidence) {
        if (existing.evidenceTitles.length < 6 && !existing.evidenceTitles.includes(item.title)) {
          existing.evidenceTitles.push(item.title);
        }
      }
      continue;
    }

    byEntry.set(chunk.entryId, {
      entryId: chunk.entryId,
      title: chunk.title,
      entryType: chunk.entryType,
      logicalPath: chunk.logicalPath,
      visibility: chunk.visibility,
      excerpt: chunk.excerpt,
      blogSlug: chunk.blogSlug,
      updatedAt: chunk.updatedAt,
      bestScore: chunk.score,
      matchingChunks: 1,
      chunkSnippets: [chunk.snippet],
      evidenceTitles: chunk.evidence.map((item) => item.title).slice(0, 6),
      tags: chunk.tags
    });
  }

  for (const item of knowledgeItems) {
    const existing = byEntry.get(item.entry.id);

    if (!existing) {
      byEntry.set(item.entry.id, {
        entryId: item.entry.id,
        title: item.entry.title,
        entryType: item.entry.entryType,
        logicalPath: item.entry.logicalPath,
        visibility: item.entry.visibility,
        excerpt: null,
        blogSlug: null,
        updatedAt: new Date().toISOString(),
        bestScore: item.score,
        matchingChunks: item.sourceChunk ? 1 : 0,
        chunkSnippets: item.sourceChunk?.snippet ? [item.sourceChunk.snippet] : [],
        evidenceTitles: [item.title],
        tags: []
      });
      continue;
    }

    existing.bestScore = Math.max(existing.bestScore, item.score);
    if (item.sourceChunk?.snippet && existing.chunkSnippets.length < 3) {
      existing.chunkSnippets.push(item.sourceChunk.snippet);
    }
    if (!existing.evidenceTitles.includes(item.title) && existing.evidenceTitles.length < 6) {
      existing.evidenceTitles.push(item.title);
    }
  }

  return [...byEntry.values()].sort((left, right) => right.bestScore - left.bestScore);
}

export const searchService = {
  async unifiedSearch(userId: string, input: UnifiedSearchInput) {
    const chunkResults = await retrieveWikiSources({
      userId,
      query: input.q,
      limit: input.limit,
      visibility: input.visibility,
      types: input.types
    });
    const [knowledgeResults, claimResults, entityResults, topicResults] = await Promise.all([
      retrieveKnowledgeResults(userId, input.q, Math.min(input.limit, 10)),
      retrieveClaimResults(userId, input.q, Math.min(input.limit, 10)),
      retrieveEntityResults(userId, input.q, Math.min(input.limit, 10)),
      retrieveTopicResults(userId, input.q, Math.min(input.limit, 10))
    ]);
    const entryResults = buildEntryResults(chunkResults, knowledgeResults).slice(
      0,
      Math.min(input.limit, 12)
    );

    return {
      ownerId: userId,
      query: input.q,
      filters: {
        limit: input.limit,
        visibility: input.visibility ?? null,
        types: input.types ?? []
      },
      summary: {
        chunkMatches: chunkResults.length,
        entryMatches: entryResults.length,
        knowledgeMatches: knowledgeResults.length,
        claimMatches: claimResults.length,
        entityMatches: entityResults.length,
        topicMatches: topicResults.length
      },
      results: chunkResults,
      entryResults,
      knowledgeResults,
      claimResults,
      entityResults,
      topicResults
    };
  }
};
