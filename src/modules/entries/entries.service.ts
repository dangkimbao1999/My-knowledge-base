import { ApiError } from "@/lib/api";
import { extractWikiLinks, toPlainText } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { refreshEntrySearchDocument } from "@/modules/entries/search-document";
import type {
  ContentFormat,
  EntryPublishMode,
  EntryType,
  EntryVisibility
} from "@/shared/enums";
import type { Prisma } from "@/generated/prisma";

type CreateTextEntryInput = {
  title: string;
  content: string;
  contentFormat: ContentFormat;
  excerpt?: string;
  logicalPath?: string;
  aliases: string[];
  tags: string[];
  visibility: EntryVisibility;
};

type CreateBookEntryInput = {
  title: string;
  fileId: string;
  author?: string;
  excerpt?: string;
  logicalPath?: string;
  aliases: string[];
  tags: string[];
  visibility: EntryVisibility;
};

type UpdateEntryInput = {
  title?: string;
  content?: string;
  contentFormat?: ContentFormat;
  excerpt?: string | null;
  logicalPath?: string | null;
  aliases?: string[];
  visibility?: EntryVisibility;
  publishMode?: EntryPublishMode;
  archivedAt?: string | null;
};

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function normalizeAliases(aliases: string[]) {
  return [...new Set(aliases.map((alias) => alias.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function normalizeLogicalPath(logicalPath?: string | null) {
  if (!logicalPath) {
    return null;
  }

  const normalized = logicalPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

  return normalized || null;
}

function inferEntryTypeFromLogicalPath(logicalPath?: string | null): EntryType {
  const normalizedPath = normalizeLogicalPath(logicalPath);
  const rootSegment = normalizedPath?.split("/")[0]?.toLowerCase();

  switch (rootSegment) {
    case "journal":
    case "journals":
    case "daily":
      return "journal";
    case "reflection":
    case "reflections":
      return "reflection";
    case "book":
    case "books":
    case "reading":
      return "book_note";
    case "idea":
    case "ideas":
      return "idea";
    case "project":
    case "projects":
      return "project_note";
    case "person":
    case "people":
      return "person_note";
    default:
      return "note";
  }
}

function slugifyTag(tag: string) {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function countWords(value: string | null) {
  if (!value) {
    return 0;
  }

  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

const entryInclude = {
  textSources: {
    where: {
      sourceKind: "raw_text"
    },
    orderBy: {
      version: "desc"
    },
    take: 1
  },
  outgoingLinks: {
    orderBy: {
      createdAt: "asc"
    }
  },
  entryTags: {
    include: {
      tag: true
    },
    orderBy: {
      tag: {
        name: "asc"
      }
    }
  },
  fileSources: {
    orderBy: {
      createdAt: "desc"
    },
    take: 1
  },
  blogPost: true
} satisfies Prisma.EntryInclude;

type EntryRecord = Prisma.EntryGetPayload<{
  include: typeof entryInclude;
}>;

type NavigationEntryRecord = {
  id: string;
  title: string;
  logicalPath: string | null;
  entryType: EntryType;
  visibility: EntryVisibility;
  updatedAt: Date;
};

type NavigationNode = {
  id: string;
  name: string;
  path: string | null;
  children: NavigationNode[];
  entries: Array<{
    id: string;
    title: string;
    logicalPath: string | null;
    entryType: EntryType;
    visibility: EntryVisibility;
    updatedAt: string;
  }>;
};

async function ensureTargetUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    }
  });

  if (!user) {
    throw new ApiError("User not provisioned", 500);
  }

  return user;
}

async function findOwnedEntry(userId: string, entryId: string) {
  const entry = await prisma.entry.findFirst({
    where: {
      id: entryId,
      ownerId: userId
    },
    include: entryInclude
  });

  if (!entry) {
    throw new ApiError("Entry not found", 404);
  }

  return entry;
}

async function resolveWikiLinksForOwner(
  tx: Prisma.TransactionClient,
  userId: string
) {
  const candidateEntries = await tx.entry.findMany({
    where: {
      ownerId: userId
    },
    select: {
      id: true,
      title: true,
      aliases: true
    }
  });

  const titleIndex = new Map<string, string>();

  for (const candidate of candidateEntries) {
    titleIndex.set(candidate.title.toLowerCase(), candidate.id);

    for (const alias of candidate.aliases) {
      titleIndex.set(alias.toLowerCase(), candidate.id);
    }
  }

  return titleIndex;
}

async function refreshResolvedLinksForOwner(
  tx: Prisma.TransactionClient,
  userId: string
) {
  const titleIndex = await resolveWikiLinksForOwner(tx, userId);
  const links = await tx.entryLink.findMany({
    where: {
      sourceEntry: {
        ownerId: userId
      }
    },
    select: {
      id: true,
      targetTitle: true,
      targetEntryId: true
    }
  });

  for (const link of links) {
    const resolvedTargetId = titleIndex.get(link.targetTitle.toLowerCase()) ?? null;

    if (resolvedTargetId !== link.targetEntryId) {
      await tx.entryLink.update({
        where: {
          id: link.id
        },
        data: {
          targetEntryId: resolvedTargetId
        }
      });
    }
  }
}

async function syncTags(
  tx: Prisma.TransactionClient,
  userId: string,
  entryId: string,
  tags: string[]
) {
  const normalizedTags = normalizeTags(tags);

  await tx.entryTag.deleteMany({
    where: {
      entryId
    }
  });

  if (normalizedTags.length === 0) {
    return [];
  }

  const tagRecords = [];

  for (const tagName of normalizedTags) {
    const slug = slugifyTag(tagName);
    const tag = await tx.tag.upsert({
      where: {
        ownerId_slug: {
          ownerId: userId,
          slug
        }
      },
      update: {
        name: tagName
      },
      create: {
        ownerId: userId,
        name: tagName,
        slug
      }
    });

    tagRecords.push(tag);
  }

  await tx.entryTag.createMany({
    data: tagRecords.map((tag) => ({
      entryId,
      tagId: tag.id
    })),
    skipDuplicates: true
  });

  return normalizedTags;
}

async function syncLinks(
  tx: Prisma.TransactionClient,
  userId: string,
  entryId: string,
  content: string | null,
  contentFormat: ContentFormat | null
) {
  await tx.entryLink.deleteMany({
    where: {
      sourceEntryId: entryId
    }
  });

  if (!content || contentFormat !== "markdown") {
    return [];
  }

  const extractedLinks = extractWikiLinks(content);
  const titleIndex = await resolveWikiLinksForOwner(tx, userId);

  if (extractedLinks.length > 0) {
    await tx.entryLink.createMany({
      data: extractedLinks.map((link) => ({
        sourceEntryId: entryId,
        targetTitle: link.targetTitle,
        linkText: link.linkText,
        targetEntryId: titleIndex.get(link.targetTitle.toLowerCase()) ?? null
      }))
    });
  }

  return extractedLinks.map((link) => ({
    targetTitle: link.targetTitle,
    linkText: link.linkText,
    targetEntryId: titleIndex.get(link.targetTitle.toLowerCase()) ?? null
  }));
}

function serializeEntry(entry: EntryRecord) {
  const latestTextSource = entry.textSources[0] ?? null;

  return {
    id: entry.id,
    ownerId: entry.ownerId,
    entryType: entry.entryType,
    title: entry.title,
    author: entry.author,
    excerpt: entry.excerpt,
    logicalPath: entry.logicalPath,
    aliases: entry.aliases,
    visibility: entry.visibility,
    publishMode: entry.publishMode,
    tags: entry.entryTags.map((entryTag) => entryTag.tag.name),
    content: latestTextSource?.content ?? null,
    contentFormat: latestTextSource?.contentFormat ?? null,
    plainText: latestTextSource?.plainText ?? null,
    wikiLinks: entry.outgoingLinks.map((link) => ({
      targetTitle: link.targetTitle,
      targetEntryId: link.targetEntryId,
      linkText: link.linkText
    })),
    fileId: entry.fileSources[0]?.id ?? null,
    archivedAt: entry.archivedAt?.toISOString() ?? null,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    blogPost: entry.blogPost
        ? {
            id: entry.blogPost.id,
            slug: entry.blogPost.slug,
            title: entry.blogPost.title,
            description: entry.blogPost.description,
            status: entry.blogPost.status,
            pinnedAt: entry.blogPost.pinnedAt?.toISOString() ?? null,
            publishedAt: entry.blogPost.publishedAt?.toISOString() ?? null
          }
        : null
  };
}

function buildNavigationTree(entries: NavigationEntryRecord[]) {
  const root: NavigationNode = {
    id: "root",
    name: "Workspace",
    path: null,
    children: [],
    entries: []
  };

  const nodeIndex = new Map<string, NavigationNode>([["", root]]);

  for (const entry of entries) {
    const normalizedPath = normalizeLogicalPath(entry.logicalPath) ?? "inbox";
    const segments = normalizedPath.split("/").filter(Boolean);
    let currentPath = "";
    let parentNode = root;

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (!nodeIndex.has(currentPath)) {
        const node: NavigationNode = {
          id: currentPath,
          name: segment,
          path: currentPath,
          children: [],
          entries: []
        };

        parentNode.children.push(node);
        nodeIndex.set(currentPath, node);
      }

      parentNode = nodeIndex.get(currentPath)!;
    }

    parentNode.entries.push({
      id: entry.id,
      title: entry.title,
      logicalPath: entry.logicalPath,
      entryType: entry.entryType,
      visibility: entry.visibility,
      updatedAt: entry.updatedAt.toISOString()
    });
  }

  function sortNode(node: NavigationNode): NavigationNode {
    node.children.sort((left, right) => left.name.localeCompare(right.name));
    node.entries.sort((left, right) => left.title.localeCompare(right.title));
    node.children.forEach(sortNode);
    return node;
  }

  return sortNode(root);
}

export const entriesService = {
  async createTextEntry(userId: string, input: CreateTextEntryInput) {
    await ensureTargetUser(userId);
    const plainText = toPlainText(input.content, input.contentFormat);
    const normalizedAliases = normalizeAliases(input.aliases);
    const normalizedLogicalPath = normalizeLogicalPath(input.logicalPath);
    const normalizedTags = normalizeTags(input.tags);
    const inferredEntryType = inferEntryTypeFromLogicalPath(normalizedLogicalPath);

    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.entry.create({
        data: {
          ownerId: userId,
          entryType: inferredEntryType,
          title: input.title,
          excerpt: input.excerpt ?? null,
          logicalPath: normalizedLogicalPath,
          aliases: normalizedAliases,
          visibility: input.visibility,
          searchDocument: "",
          textSources: {
            create: {
              sourceKind: "raw_text",
              contentFormat: input.contentFormat,
              content: input.content,
              plainText,
              wordCount: countWords(plainText)
            }
          }
        },
        include: entryInclude
      });

      await syncTags(tx, userId, entry.id, normalizedTags);
      await syncLinks(tx, userId, entry.id, input.content, input.contentFormat);
      await refreshResolvedLinksForOwner(tx, userId);
      await refreshEntrySearchDocument(tx, entry.id);

      return tx.entry.findUniqueOrThrow({
        where: {
          id: entry.id
        },
        include: entryInclude
      });
    });

    return serializeEntry(created);
  },

  async createBookEntry(userId: string, input: CreateBookEntryInput) {
    await ensureTargetUser(userId);
    const normalizedAliases = normalizeAliases(input.aliases);
    const normalizedLogicalPath = normalizeLogicalPath(input.logicalPath);
    const normalizedTags = normalizeTags(input.tags);

    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.entry.create({
        data: {
          ownerId: userId,
          entryType: "book",
          title: input.title,
          author: input.author ?? null,
          excerpt: input.excerpt ?? null,
          logicalPath: normalizedLogicalPath,
          aliases: normalizedAliases,
          visibility: input.visibility,
          searchDocument: ""
        },
        include: entryInclude
      });

      await syncTags(tx, userId, entry.id, normalizedTags);

      if (input.fileId) {
        await tx.entryFileSource.updateMany({
          where: {
            id: input.fileId,
            ownerId: userId
          },
          data: {
            entryId: entry.id
          }
        });
      }

      await refreshResolvedLinksForOwner(tx, userId);
      await refreshEntrySearchDocument(tx, entry.id);

      return tx.entry.findUniqueOrThrow({
        where: {
          id: entry.id
        },
        include: entryInclude
      });
    });

    return serializeEntry(created);
  },

  async listEntries(userId: string, query: URLSearchParams) {
    const search = query.get("q")?.trim();
    const type = query.get("type");
    const visibility = query.get("visibility");
    const items = await prisma.entry.findMany({
      where: {
        ownerId: userId,
        ...(type ? { entryType: type as EntryType } : {}),
        ...(visibility ? { visibility: visibility as EntryVisibility } : {}),
        ...(search
          ? {
              OR: [
                {
                  title: {
                    contains: search,
                    mode: "insensitive"
                  }
                },
                {
                  excerpt: {
                    contains: search,
                    mode: "insensitive"
                  }
                },
                {
                  logicalPath: {
                    contains: search,
                    mode: "insensitive"
                  }
                },
                {
                  aliases: {
                    has: search
                  }
                },
                {
                  searchDocument: {
                    contains: search,
                    mode: "insensitive"
                  }
                },
                {
                  outgoingLinks: {
                    some: {
                      targetTitle: {
                        contains: search,
                        mode: "insensitive"
                      }
                    }
                  }
                }
              ]
            }
          : {})
      },
      include: entryInclude,
      orderBy: {
        updatedAt: "desc"
      }
    });

    return {
      items: items.map(serializeEntry),
      filters: {
        ownerId: userId,
        q: search ?? null,
        type: type ?? null,
        visibility: visibility ?? null
      }
    };
  },

  async getEntryDetail(userId: string, entryId: string) {
    return serializeEntry(await findOwnedEntry(userId, entryId));
  },

  async getNavigationTree(userId: string) {
    const entries = await prisma.entry.findMany({
      where: {
        ownerId: userId
      },
      select: {
        id: true,
        title: true,
        logicalPath: true,
        entryType: true,
        visibility: true,
        updatedAt: true
      },
      orderBy: [
        {
          logicalPath: "asc"
        },
        {
          title: "asc"
        }
      ]
    });

    return {
      root: buildNavigationTree(entries),
      totalEntries: entries.length
    };
  },

  async updateEntry(userId: string, entryId: string, input: UpdateEntryInput) {
    const currentEntry = await findOwnedEntry(userId, entryId);
    const currentTextSource = currentEntry.textSources[0] ?? null;
    const nextContent = input.content ?? currentTextSource?.content ?? null;
    const nextContentFormat = input.contentFormat ?? currentTextSource?.contentFormat ?? null;
    const nextPlainText =
      nextContent && nextContentFormat
        ? toPlainText(nextContent, nextContentFormat)
        : null;
    const nextAliases =
      input.aliases === undefined
        ? currentEntry.aliases
        : normalizeAliases(input.aliases);
    const nextLogicalPath =
      input.logicalPath === undefined
        ? currentEntry.logicalPath
        : normalizeLogicalPath(input.logicalPath);
    const nextEntryType =
      currentEntry.entryType === "book"
        ? "book"
        : inferEntryTypeFromLogicalPath(nextLogicalPath);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.entry.update({
        where: {
          id: entryId
        },
        data: {
          title: input.title ?? currentEntry.title,
          excerpt:
            input.excerpt === undefined
              ? currentEntry.excerpt
              : input.excerpt,
          entryType: nextEntryType,
          logicalPath: nextLogicalPath,
          aliases: nextAliases,
          visibility: input.visibility ?? currentEntry.visibility,
          publishMode: input.publishMode ?? currentEntry.publishMode,
          archivedAt:
            input.archivedAt === undefined
              ? currentEntry.archivedAt
              : input.archivedAt
                ? new Date(input.archivedAt)
                : null,
          latestSourceVersion:
            input.content !== undefined || input.contentFormat !== undefined
              ? currentEntry.latestSourceVersion + 1
              : currentEntry.latestSourceVersion
        }
      });

      if (input.content !== undefined || input.contentFormat !== undefined) {
        if (nextContent && nextContentFormat) {
          await tx.entryTextSource.create({
            data: {
              entryId,
              sourceKind: "raw_text",
              contentFormat: nextContentFormat,
              version: currentEntry.latestSourceVersion + 1,
              content: nextContent,
              plainText: nextPlainText,
              wordCount: countWords(nextPlainText)
            }
          });
        }

        await syncLinks(tx, userId, entryId, nextContent, nextContentFormat);
      }

      await refreshResolvedLinksForOwner(tx, userId);

      await refreshEntrySearchDocument(tx, entryId);

      return tx.entry.findUniqueOrThrow({
        where: {
          id: entryId
        },
        include: entryInclude
      });
    });

    return serializeEntry(updated);
  },

  async deleteEntry(userId: string, entryId: string) {
    await findOwnedEntry(userId, entryId);
    await prisma.$transaction(async (tx) => {
      await tx.entry.delete({
        where: {
          id: entryId
        }
      });

      await refreshResolvedLinksForOwner(tx, userId);
    });

    return {
      id: entryId,
      ownerId: userId,
      deleted: true
    };
  },

  async updateVisibility(userId: string, entryId: string, visibility: string) {
    return this.updateEntry(userId, entryId, {
      visibility: visibility as EntryVisibility
    });
  },

  async updateTags(userId: string, entryId: string, tags: string[]) {
    const updated = await prisma.$transaction(async (tx) => {
      await syncTags(tx, userId, entryId, tags);
      await refreshEntrySearchDocument(tx, entryId);

      return tx.entry.findUniqueOrThrow({
        where: {
          id: entryId
        },
        include: entryInclude
      });
    });

    return serializeEntry(updated);
  },

  async updatePublishMode(userId: string, entryId: string, publishMode: string) {
    return this.updateEntry(userId, entryId, {
      publishMode: publishMode as EntryPublishMode
    });
  }
};
