import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

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

function buildPublishedContent(input: {
  entryType: string;
  title: string;
  excerpt?: string | null;
  markdown?: string | null;
  publishMode: string;
}) {
  const sections: string[] = [`# ${input.title}`];

  if (input.excerpt) {
    sections.push(input.excerpt);
  }

  if (input.entryType === "book") {
    if (!input.excerpt) {
      throw new ApiError(
        "Book entries require an excerpt or reflection before publishing.",
        400
      );
    }

    return sections.join("\n\n");
  }

  if (input.publishMode === "summary_only") {
    if (!input.excerpt) {
      throw new ApiError(
        "Summary-only publish mode requires an excerpt for now.",
        400
      );
    }

    return sections.join("\n\n");
  }

  if (input.markdown) {
    sections.push(input.markdown);
  } else if (!input.excerpt) {
    throw new ApiError("This entry has no publishable text content yet.", 400);
  }

  return sections.join("\n\n");
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
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString()
  };
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
    const publishMode =
      input.publishMode ??
      (entry.publishMode === "none" ? "notes_only" : entry.publishMode);
    const publishedContent = buildPublishedContent({
      entryType: entry.entryType,
      title: input.title ?? entry.title,
      excerpt: input.description ?? entry.excerpt,
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

  async listPosts() {
    const posts = await prisma.blogPost.findMany({
      where: {
        status: "published"
      },
      orderBy: {
        publishedAt: "desc"
      }
    });

    return {
      items: posts.map(serializeBlogPost)
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
  }
};
