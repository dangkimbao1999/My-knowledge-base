import type { EntryType, EntryVisibility } from "@/shared/enums";
import { prisma } from "@/lib/prisma";

type RetrieveWikiSourcesInput = {
  userId: string;
  query: string;
  limit?: number;
  visibility?: EntryVisibility;
  types?: EntryType[];
};

type SearchableEntry = {
  id: string;
  entryType: EntryType;
  title: string;
  excerpt: string | null;
  logicalPath: string | null;
  aliases: string[];
  visibility: EntryVisibility;
  searchDocument: string | null;
  updatedAt: Date;
  textSources: Array<{
    content: string;
    plainText: string | null;
    contentFormat: string;
  }>;
  entryTags: Array<{
    tag: {
      name: string;
    };
  }>;
  outgoingLinks: Array<{
    targetTitle: string;
    linkText: string | null;
    targetEntryId: string | null;
  }>;
  blogPost: {
    slug: string;
  } | null;
};

function tokenize(value: string) {
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length > 1)
    )
  ];
}

function countMatches(haystack: string, needles: string[]) {
  const normalizedHaystack = haystack.toLowerCase();
  let matches = 0;

  for (const needle of needles) {
    if (normalizedHaystack.includes(needle)) {
      matches += 1;
    }
  }

  return matches;
}

function buildSnippet(text: string, tokens: string[]) {
  const compactText = text.replace(/\s+/g, " ").trim();

  if (!compactText) {
    return "";
  }

  const lowered = compactText.toLowerCase();
  const matchedIndex = tokens
    .map((token) => lowered.indexOf(token))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (matchedIndex === undefined) {
    return compactText.slice(0, 220);
  }

  const start = Math.max(0, matchedIndex - 80);
  const end = Math.min(compactText.length, matchedIndex + 180);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < compactText.length ? "..." : "";

  return `${prefix}${compactText.slice(start, end).trim()}${suffix}`;
}

function scoreEntry(entry: SearchableEntry, rawQuery: string, tokens: string[]) {
  const title = entry.title.toLowerCase();
  const excerpt = (entry.excerpt ?? "").toLowerCase();
  const logicalPath = (entry.logicalPath ?? "").toLowerCase();
  const aliases = entry.aliases.join(" ").toLowerCase();
  const tags = entry.entryTags.map((item) => item.tag.name).join(" ").toLowerCase();
  const links = entry.outgoingLinks
    .map((link) => `${link.targetTitle} ${link.linkText ?? ""}`)
    .join(" ")
    .toLowerCase();
  const plainText = (entry.textSources[0]?.plainText ?? "").toLowerCase();
  const normalizedQuery = rawQuery.toLowerCase();

  let score = 0;

  if (title.includes(normalizedQuery)) {
    score += 36;
  }

  if (logicalPath.includes(normalizedQuery)) {
    score += 16;
  }

  if (aliases.includes(normalizedQuery)) {
    score += 14;
  }

  if (excerpt.includes(normalizedQuery)) {
    score += 12;
  }

  if (tags.includes(normalizedQuery)) {
    score += 10;
  }

  score += countMatches(title, tokens) * 8;
  score += countMatches(logicalPath, tokens) * 6;
  score += countMatches(aliases, tokens) * 5;
  score += countMatches(tags, tokens) * 4;
  score += countMatches(excerpt, tokens) * 4;
  score += Math.min(12, countMatches(plainText, tokens) * 2);
  score += Math.min(8, countMatches(links, tokens) * 2);

  return score;
}

function toSource(entry: SearchableEntry, score: number, queryTokens: string[]) {
  const plainText = entry.textSources[0]?.plainText ?? "";
  const snippet = buildSnippet(plainText || entry.excerpt || entry.title, queryTokens);

  return {
    entryId: entry.id,
    title: entry.title,
    entryType: entry.entryType,
    logicalPath: entry.logicalPath,
    visibility: entry.visibility,
    excerpt: entry.excerpt,
    snippet,
    plainText,
    tags: entry.entryTags.map((item) => item.tag.name),
    aliases: entry.aliases,
    wikiLinks: entry.outgoingLinks.map((link) => ({
      targetTitle: link.targetTitle,
      linkText: link.linkText,
      targetEntryId: link.targetEntryId
    })),
    blogSlug: entry.blogPost?.slug ?? null,
    updatedAt: entry.updatedAt.toISOString(),
    score
  };
}

export async function retrieveWikiSources(input: RetrieveWikiSourcesInput) {
  const query = input.query.trim();
  const limit = input.limit ?? 6;

  if (!query) {
    return [];
  }

  const tokens = tokenize(query);
  const entries = await prisma.entry.findMany({
    where: {
      ownerId: input.userId,
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.types?.length ? { entryType: { in: input.types } } : {}),
      OR: [
        {
          title: {
            contains: query,
            mode: "insensitive"
          }
        },
        {
          excerpt: {
            contains: query,
            mode: "insensitive"
          }
        },
        {
          logicalPath: {
            contains: query,
            mode: "insensitive"
          }
        },
        {
          searchDocument: {
            contains: query,
            mode: "insensitive"
          }
        },
        {
          outgoingLinks: {
            some: {
              targetTitle: {
                contains: query,
                mode: "insensitive"
              }
            }
          }
        },
        ...tokens.map((token) => ({
          searchDocument: {
            contains: token,
            mode: "insensitive" as const
          }
        }))
      ]
    },
    include: {
      textSources: {
        where: {
          sourceKind: "raw_text"
        },
        orderBy: {
          version: "desc"
        },
        take: 1
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
    },
    orderBy: [
      {
        updatedAt: "desc"
      }
    ],
    take: 40
  });

  return entries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, query, tokens)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => toSource(item.entry, item.score, tokens));
}
