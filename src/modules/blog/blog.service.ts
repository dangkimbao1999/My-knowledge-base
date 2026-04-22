import { ApiError } from "@/lib/api";
import { extractWikiLinks } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { buildPublishedContent } from "@/modules/blog/published-content";

type PublishInput = {
  entryId: string;
  slug: string;
  title?: string;
  description?: string;
  publishMode?: "none" | "summary_only" | "notes_only" | "summary_and_notes";
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function serializeBlogPost(post: Awaited<ReturnType<typeof prisma.blogPost.findUniqueOrThrow>>) {
  return {
    id: post.id,
    entryId: post.entryId,
    slug: post.slug,
    title: post.title,
    description: post.description,
    status: post.status,
    publishedContent: post.publishedContent,
    pinnedAt: post.pinnedAt?.toISOString() ?? null,
    pinSlot: post.pinSlot ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString()
  };
}

function serializeListPost(post: {
  id: string;
  entryId: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  publishedContent: string;
  pinnedAt: Date | null;
  pinSlot: number | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  entry: {
    logicalPath: string | null;
  };
}) {
  return {
    id: post.id,
    entryId: post.entryId,
    slug: post.slug,
    title: post.title,
    description: post.description,
    status: post.status,
    publishedContent: post.publishedContent,
    pinnedAt: post.pinnedAt?.toISOString() ?? null,
    pinSlot: post.pinSlot ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    logicalPath: post.entry.logicalPath
  };
}

function sortPublishedPosts<
  T extends {
    pinSlot: number | null;
    publishedAt: Date | null;
    createdAt: Date;
  }
>(posts: T[]) {
  return [...posts].sort((left, right) => {
    const leftPinned = left.pinSlot !== null;
    const rightPinned = right.pinSlot !== null;

    if (leftPinned && rightPinned) {
      if (left.pinSlot !== right.pinSlot) {
        return (left.pinSlot ?? 999) - (right.pinSlot ?? 999);
      }
    } else if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    const leftPublished = left.publishedAt?.getTime() ?? left.createdAt.getTime();
    const rightPublished = right.publishedAt?.getTime() ?? right.createdAt.getTime();

    return rightPublished - leftPublished;
  });
}

export const blogService = {
  async publishEntry(userId: string, input: PublishInput) {
    const normalizedSlug = normalizeSlug(input.slug);

    if (!normalizedSlug) {
      throw new ApiError("Slug is required", 400);
    }

    const entry = await prisma.entry.findFirst({
      where: {
        id: input.entryId,
        ownerId: userId
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
        notes: {
          orderBy: {
            createdAt: "asc"
          }
        },
        aiSummaries: {
          where: {
            status: "active"
          },
          orderBy: {
            version: "desc"
          },
          take: 1
        },
        blogPost: true
      }
    });

    if (!entry) {
      throw new ApiError("Entry not found", 404);
    }

    const slugOwner = await prisma.blogPost.findUnique({
      where: {
        slug: normalizedSlug
      }
    });

    if (slugOwner && slugOwner.entryId !== entry.id) {
      throw new ApiError("Slug is already in use", 409);
    }

    const latestTextSource = entry.textSources[0] ?? null;
    const latestSummary = entry.aiSummaries[0] ?? null;
    const notesMarkdown = entry.notes
      .map((note) => {
        const heading = note.title ?? note.chapterLabel ?? note.noteType;
        return `## ${heading}\n\n${note.content}`;
      })
      .join("\n\n");
    const publishMode =
      input.publishMode ??
      (entry.publishMode === "none" ? "notes_only" : entry.publishMode);
    const publishedContent = buildPublishedContent({
      entryType: entry.entryType,
      title: input.title ?? entry.title,
      excerpt: input.description ?? entry.excerpt,
      summaryMarkdown: latestSummary?.summaryMarkdown ?? null,
      notesMarkdown: notesMarkdown || null,
      markdown: latestTextSource?.content ?? null,
      publishMode
    });

    const published = await prisma.$transaction(async (tx) => {
      await tx.entry.update({
        where: {
          id: entry.id
        },
        data: {
          visibility: "public",
          publishMode,
          publishedAt: new Date()
        }
      });

      await tx.blogPost.upsert({
        where: {
          entryId: entry.id
        },
        update: {
          slug: normalizedSlug,
          title: input.title ?? entry.title,
          description: input.description ?? entry.excerpt,
          status: "published",
          publishedContent,
          publishedAt: new Date()
        },
        create: {
          entryId: entry.id,
          slug: normalizedSlug,
          title: input.title ?? entry.title,
          description: input.description ?? entry.excerpt,
          status: "published",
          publishedContent,
          publishedAt: new Date()
        }
      });

      return tx.blogPost.findUniqueOrThrow({
        where: {
          entryId: entry.id
        }
      });
    });

    return serializeBlogPost(published);
  },

  async unpublishEntry(userId: string, entryId: string) {
    const entry = await prisma.entry.findFirst({
      where: {
        id: entryId,
        ownerId: userId
      },
      include: {
        blogPost: true
      }
    });

    if (!entry) {
      throw new ApiError("Entry not found", 404);
    }

    if (!entry.blogPost) {
      throw new ApiError("Blog post not found", 404);
    }

    const post = await prisma.$transaction(async (tx) => {
      await tx.entry.update({
        where: {
          id: entry.id
        },
        data: {
          publishedAt: null
        }
      });

      await tx.blogPost.update({
        where: {
          entryId: entry.id
        },
        data: {
          status: "unpublished",
          pinnedAt: null,
          pinSlot: null,
          publishedAt: null
        }
      });

      return tx.blogPost.findUniqueOrThrow({
        where: {
          entryId: entry.id
        }
      });
    });

    return serializeBlogPost(post);
  },

  async deletePost(userId: string, entryId: string) {
    const entry = await prisma.entry.findFirst({
      where: {
        id: entryId,
        ownerId: userId
      },
      include: {
        blogPost: true
      }
    });

    if (!entry) {
      throw new ApiError("Entry not found", 404);
    }

    if (!entry.blogPost) {
      throw new ApiError("Blog post not found", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.entry.update({
        where: {
          id: entry.id
        },
        data: {
          visibility: "private",
          publishMode: "none",
          publishedAt: null
        }
      });

      await tx.blogPost.delete({
        where: {
          entryId: entry.id
        }
      });
    });

    return {
      entryId: entry.id,
      deleted: true
    };
  },

  async listPosts() {
    const posts = await prisma.blogPost.findMany({
      where: {
        status: "published"
      },
      include: {
        entry: {
          select: {
            logicalPath: true
          }
        }
      },
      orderBy: {
        publishedAt: "desc"
      }
    });

    return {
      items: sortPublishedPosts(posts).map(serializeListPost)
    };
  },

  async listLogicalPaths() {
    const rows = await prisma.blogPost.findMany({
      where: {
        status: "published",
        entry: {
          logicalPath: {
            not: null
          }
        }
      },
      select: {
        entry: {
          select: {
            logicalPath: true
          }
        }
      }
    });

    const counts = new Map<string, number>();

    for (const row of rows) {
      const logicalPath = row.entry.logicalPath?.trim();

      if (!logicalPath) {
        continue;
      }

      counts.set(logicalPath, (counts.get(logicalPath) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([logicalPath, postCount]) => ({
        logicalPath,
        postCount
      }));
  },

  async listPostsByLogicalPath(logicalPath?: string | null) {
    const normalizedPath = logicalPath?.trim() || null;
    const posts = await prisma.blogPost.findMany({
      where: {
        status: "published",
        ...(normalizedPath
          ? {
              entry: {
                logicalPath: normalizedPath
              }
            }
          : {})
      },
      include: {
        entry: {
          select: {
            logicalPath: true
          }
        }
      },
      orderBy: {
        publishedAt: "desc"
      }
    });

    return {
      logicalPath: normalizedPath,
      items: sortPublishedPosts(posts).map(serializeListPost)
    };
  },

  async getPublicPost(slug: string) {
    const post = await prisma.blogPost.findFirst({
      where: {
        slug,
        status: "published"
      }
    });

    if (!post) {
      throw new ApiError("Blog post not found", 404);
    }

    return serializeBlogPost(post);
  },

  async resolvePublicWikiLinkMap(markdown: string) {
    const extractedLinks = extractWikiLinks(markdown);

    if (extractedLinks.length === 0) {
      return {};
    }

    const posts = await prisma.blogPost.findMany({
      where: {
        status: "published"
      },
      include: {
        entry: {
          select: {
            title: true,
            aliases: true
          }
        }
      }
    });

    const hrefMap: Record<string, string> = {};

    for (const post of posts) {
      hrefMap[post.entry.title.trim().toLowerCase()] = `/blog/${post.slug}`;

      for (const alias of post.entry.aliases) {
        hrefMap[alias.trim().toLowerCase()] = `/blog/${post.slug}`;
      }
    }

    return extractedLinks.reduce<Record<string, string>>((accumulator, link) => {
      const href = hrefMap[link.targetTitle.trim().toLowerCase()];

      if (href) {
        accumulator[link.targetTitle.trim().toLowerCase()] = href;
      }

      return accumulator;
    }, {});
  },

  async pinEntry(userId: string, entryId: string, pinSlot: number) {
    const entry = await prisma.entry.findFirst({
      where: {
        id: entryId,
        ownerId: userId
      },
      include: {
        blogPost: true
      }
    });

    if (!entry) {
      throw new ApiError("Entry not found", 404);
    }

    if (!entry.blogPost || entry.blogPost.status !== "published") {
      throw new ApiError("Only published blog posts can be pinned", 400);
    }

    const now = new Date();

    const post = await prisma.$transaction(async (tx) => {
      await tx.blogPost.updateMany({
        where: {
          status: "published",
          pinSlot,
          NOT: {
            entryId: entry.id
          }
        },
        data: {
          pinSlot: null,
          pinnedAt: null
        }
      });

      await tx.blogPost.update({
        where: {
          entryId: entry.id
        },
        data: {
          pinnedAt: now,
          pinSlot
        }
      });

      return tx.blogPost.findUniqueOrThrow({
        where: {
          entryId: entry.id
        }
      });
    });

    return serializeBlogPost(post);
  },

  async unpinEntry(userId: string, entryId: string) {
    const entry = await prisma.entry.findFirst({
      where: {
        id: entryId,
        ownerId: userId
      },
      include: {
        blogPost: true
      }
    });

    if (!entry) {
      throw new ApiError("Entry not found", 404);
    }

    if (!entry.blogPost) {
      throw new ApiError("Blog post not found", 404);
    }

    const post = await prisma.blogPost.update({
      where: {
        entryId: entry.id
      },
      data: {
        pinnedAt: null,
        pinSlot: null
      }
    });

    return serializeBlogPost(post);
  }
};
