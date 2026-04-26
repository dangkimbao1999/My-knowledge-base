import type { Prisma } from "@/generated/prisma";
import type { EntryType, EntryVisibility } from "@/shared/enums";
import { env } from "@/config/env";
import { buildSnippet, countMatches, tokenize } from "@/lib/retrieval";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/modules/ai/ai.provider";

type RetrieveWikiSourcesInput = {
  userId: string;
  query: string;
  limit?: number;
  visibility?: EntryVisibility;
  types?: EntryType[];
};

const sourceChunkQueryArgs = {
  include: {
    entry: {
      include: {
        aiSummaries: {
          where: {
            status: "active"
          },
          orderBy: {
            version: "desc"
          },
          select: {
            summaryMarkdown: true
          },
          take: 1
        },
        aiTopics: {
          where: {
            status: "active"
          },
          select: {
            topic: true,
            slug: true
          },
          take: 8
        },
        entryTags: {
          include: {
            tag: true
          }
        },
        outgoingLinks: {
          orderBy: {
            createdAt: "asc"
          }
        },
        blogPost: {
          select: {
            slug: true
          }
        }
      }
    },
    knowledgeClaims: {
      where: {
        status: "active"
      },
      select: {
        id: true,
        content: true,
        claimType: true,
        claimEntities: {
          select: {
            entity: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        }
      },
      take: 6
    }
  }
} satisfies Prisma.SourceChunkFindManyArgs;

type SearchableChunk = Prisma.SourceChunkGetPayload<typeof sourceChunkQueryArgs>;

function buildKnowledgeClause(needle: string): Prisma.SourceChunkWhereInput {
  return {
    knowledgeClaims: {
      some: {
        status: "active",
        OR: [
          {
            content: {
              contains: needle,
              mode: "insensitive"
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
                          mode: "insensitive"
                        }
                      },
                      {
                        slug: {
                          contains: needle,
                          mode: "insensitive"
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        ]
      }
    }
  };
}

function buildEntryClause(needle: string): Prisma.SourceChunkWhereInput {
  return {
    entry: {
      is: {
        OR: [
          {
            title: {
              contains: needle,
              mode: "insensitive"
            }
          },
          {
            excerpt: {
              contains: needle,
              mode: "insensitive"
            }
          },
          {
            logicalPath: {
              contains: needle,
              mode: "insensitive"
            }
          },
          {
            searchDocument: {
              contains: needle,
              mode: "insensitive"
            }
          }
        ]
      }
    }
  };
}

function scoreChunkLexically(chunk: SearchableChunk, rawQuery: string, tokens: string[]) {
  const title = chunk.entry.title.toLowerCase();
  const excerpt = (chunk.entry.excerpt ?? "").toLowerCase();
  const logicalPath = (chunk.entry.logicalPath ?? "").toLowerCase();
  const aliases = chunk.entry.aliases.join(" ").toLowerCase();
  const tags = chunk.entry.entryTags.map((item) => item.tag.name).join(" ").toLowerCase();
  const summaryText = (chunk.entry.aiSummaries[0]?.summaryMarkdown ?? "").toLowerCase();
  const topicText = chunk.entry.aiTopics
    .map((item) => `${item.topic} ${item.slug}`)
    .join(" ")
    .toLowerCase();
  const links = chunk.entry.outgoingLinks
    .map((link) => `${link.targetTitle} ${link.linkText ?? ""}`)
    .join(" ")
    .toLowerCase();
  const chunkText = chunk.content.toLowerCase();
  const claimText = chunk.knowledgeClaims
    .map(
      (item) =>
        `${item.claimType} ${item.content} ${item.claimEntities
          .map((claimEntity) => `${claimEntity.entity.name} ${claimEntity.entity.slug}`)
          .join(" ")}`
    )
    .join(" ")
    .toLowerCase();
  const normalizedQuery = rawQuery.toLowerCase();

  let score = 0;

  if (title.includes(normalizedQuery)) {
    score += 26;
  }

  if (chunkText.includes(normalizedQuery)) {
    score += 24;
  }

  if (claimText.includes(normalizedQuery)) {
    score += 20;
  }

  if (summaryText.includes(normalizedQuery)) {
    score += 14;
  }

  if (topicText.includes(normalizedQuery)) {
    score += 12;
  }

  if (logicalPath.includes(normalizedQuery)) {
    score += 12;
  }

  if (aliases.includes(normalizedQuery)) {
    score += 10;
  }

  if (excerpt.includes(normalizedQuery)) {
    score += 8;
  }

  score += countMatches(title, tokens) * 8;
  score += Math.min(24, countMatches(chunkText, tokens) * 3);
  score += Math.min(20, countMatches(claimText, tokens) * 3);
  score += Math.min(12, countMatches(summaryText, tokens) * 2);
  score += Math.min(10, countMatches(topicText, tokens) * 2);
  score += countMatches(logicalPath, tokens) * 5;
  score += countMatches(aliases, tokens) * 4;
  score += countMatches(tags, tokens) * 4;
  score += countMatches(excerpt, tokens) * 3;
  score += Math.min(8, countMatches(links, tokens) * 2);

  return score;
}

function parseEmbedding(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return null;
  }

  const vector = value
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isFinite(item));

  return vector.length > 0 ? vector : null;
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function combineScores(input: {
  lexicalScore: number;
  semanticScore: number;
  evidenceCount: number;
}) {
  const semanticBoost = input.semanticScore > 0 ? input.semanticScore * 32 : 0;
  const evidenceBoost = Math.min(4, input.evidenceCount);

  return input.lexicalScore + semanticBoost + evidenceBoost;
}

async function buildQueryEmbedding(query: string) {
  if (!env.OPENAI_API_KEY || !env.EMBEDDING_MODEL) {
    return null;
  }

  try {
    const ai = getAIProvider();
    const result = await ai.embedTexts({
      texts: [query]
    });

    return result.vectors[0] ?? null;
  } catch (error) {
    console.warn("Query embedding generation failed; using lexical retrieval only.", error);
    return null;
  }
}

async function retrieveLexicalChunks(
  where: Prisma.SourceChunkWhereInput,
  query: string,
  tokens: string[]
) {
  const chunks = await prisma.sourceChunk.findMany({
    ...sourceChunkQueryArgs,
    where,
    orderBy: [
      {
        updatedAt: "desc"
      }
    ],
    take: 80
  });

  return chunks
    .map((chunk) => ({
      chunk,
      lexicalScore: scoreChunkLexically(chunk, query, tokens)
    }))
    .filter((item) => item.lexicalScore > 0);
}

async function retrieveSemanticCandidates(entryWhere: Prisma.EntryWhereInput) {
  const chunks = await prisma.sourceChunk.findMany({
    ...sourceChunkQueryArgs,
    where: {
      entry: {
        is: entryWhere
      }
    },
    orderBy: [
      {
        updatedAt: "desc"
      }
    ],
    take: 180
  });

  return chunks.filter((chunk) => parseEmbedding(chunk.embedding) !== null);
}

function toSource(
  chunk: SearchableChunk,
  input: {
    lexicalScore: number;
    semanticScore: number;
    hybridScore: number;
  },
  queryTokens: string[]
) {
  const snippet = buildSnippet(chunk.content || chunk.entry.excerpt || chunk.entry.title, queryTokens);

  return {
    sourceType: "source_chunk" as const,
    retrievalMode:
      input.semanticScore > 0 && input.lexicalScore > 0
        ? "hybrid"
        : input.semanticScore > 0
          ? "semantic"
          : "lexical",
    sourceChunkId: chunk.id,
    chunkIndex: chunk.chunkIndex,
    entryId: chunk.entry.id,
    title: chunk.entry.title,
    entryType: chunk.entry.entryType,
    logicalPath: chunk.entry.logicalPath,
    visibility: chunk.entry.visibility,
    excerpt: chunk.entry.excerpt,
    snippet,
    chunkText: chunk.content,
    summary: chunk.entry.aiSummaries[0]?.summaryMarkdown ?? null,
    topics: chunk.entry.aiTopics.map((item) => item.topic),
    tokenEstimate: chunk.tokenEstimate,
    tags: chunk.entry.entryTags.map((item) => item.tag.name),
    aliases: chunk.entry.aliases,
    wikiLinks: chunk.entry.outgoingLinks.map((link) => ({
      targetTitle: link.targetTitle,
      linkText: link.linkText,
      targetEntryId: link.targetEntryId
    })),
    claims: chunk.knowledgeClaims.map((item) => ({
      id: item.id,
      claimType: item.claimType,
      content: item.content,
      entities: item.claimEntities.map((claimEntity) => ({
        name: claimEntity.entity.name,
        slug: claimEntity.entity.slug
      }))
    })),
    blogSlug: chunk.entry.blogPost?.slug ?? null,
    updatedAt: chunk.entry.updatedAt.toISOString(),
    lexicalScore: input.lexicalScore,
    semanticScore: Number(input.semanticScore.toFixed(4)),
    score: Number(input.hybridScore.toFixed(4))
  };
}

export async function retrieveWikiSources(input: RetrieveWikiSourcesInput) {
  const query = input.query.trim();
  const limit = input.limit ?? 6;

  if (!query) {
    return [];
  }

  const tokens = tokenize(query);
  const searchNeedles = [...new Set([query, ...tokens])];
  const entryWhere: Prisma.EntryWhereInput = {
    ownerId: input.userId,
    ...(input.visibility ? { visibility: input.visibility } : {}),
    ...(input.types?.length ? { entryType: { in: input.types } } : {}),
    archivedAt: null
  };
  const lexicalWhere: Prisma.SourceChunkWhereInput = {
    entry: {
      is: entryWhere
    },
    OR: [
      {
        content: {
          contains: query,
          mode: "insensitive"
        }
      },
      buildKnowledgeClause(query),
      ...searchNeedles.map((needle) => ({
        content: {
          contains: needle,
          mode: "insensitive" as const
        }
      })),
      ...searchNeedles.map(buildKnowledgeClause),
      ...searchNeedles.map(buildEntryClause)
    ]
  };

  const [lexicalMatches, queryEmbedding] = await Promise.all([
    retrieveLexicalChunks(lexicalWhere, query, tokens),
    buildQueryEmbedding(query)
  ]);

  const semanticCandidates = queryEmbedding
    ? await retrieveSemanticCandidates(entryWhere)
    : [];

  const scored = new Map<
    string,
    {
      chunk: SearchableChunk;
      lexicalScore: number;
      semanticScore: number;
      hybridScore: number;
    }
  >();

  for (const item of lexicalMatches) {
    const hybridScore = combineScores({
      lexicalScore: item.lexicalScore,
      semanticScore: 0,
      evidenceCount: item.chunk.knowledgeClaims.length
    });

    scored.set(item.chunk.id, {
      chunk: item.chunk,
      lexicalScore: item.lexicalScore,
      semanticScore: 0,
      hybridScore
    });
  }

  if (queryEmbedding) {
    for (const chunk of semanticCandidates) {
      const chunkEmbedding = parseEmbedding(chunk.embedding);

      if (!chunkEmbedding) {
        continue;
      }

      const semanticScore = cosineSimilarity(queryEmbedding, chunkEmbedding);

      if (semanticScore <= 0.08) {
        continue;
      }

      const existing = scored.get(chunk.id);
      const lexicalScore = existing?.lexicalScore ?? scoreChunkLexically(chunk, query, tokens);
      const hybridScore = combineScores({
        lexicalScore,
        semanticScore,
        evidenceCount: chunk.knowledgeClaims.length
      });

      scored.set(chunk.id, {
        chunk,
        lexicalScore,
        semanticScore: Math.max(existing?.semanticScore ?? 0, semanticScore),
        hybridScore: Math.max(existing?.hybridScore ?? 0, hybridScore)
      });
    }
  }

  return [...scored.values()]
    .filter((item) => item.hybridScore > 0)
    .sort((left, right) => right.hybridScore - left.hybridScore)
    .slice(0, limit)
    .map((item) =>
      toSource(
        item.chunk,
        {
          lexicalScore: item.lexicalScore,
          semanticScore: item.semanticScore,
          hybridScore: item.hybridScore
        },
        tokens
      )
    );
}
