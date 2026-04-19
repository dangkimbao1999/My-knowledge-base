import { prisma } from "@/lib/prisma";

function serializeKnowledgeItem(item: {
  id: string;
  title: string;
  content: string;
  sourceReferences: unknown;
  modelName: string;
  promptVersion: string;
  createdAt: Date;
  updatedAt: Date;
  entry: {
    id: string;
    title: string;
    entryType: string;
    logicalPath: string | null;
    visibility: string;
  };
}) {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    sourceReferences: item.sourceReferences,
    modelName: item.modelName,
    promptVersion: item.promptVersion,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    entry: {
      id: item.entry.id,
      title: item.entry.title,
      entryType: item.entry.entryType,
      logicalPath: item.entry.logicalPath,
      visibility: item.entry.visibility
    }
  };
}

export const knowledgeService = {
  async listKnowledge(userId: string, topicSlug?: string) {
    const items = await prisma.aIKnowledgeItem.findMany({
      where: {
        status: "active",
        entry: {
          ownerId: userId,
          ...(topicSlug
            ? {
                aiTopics: {
                  some: {
                    status: "active",
                    slug: topicSlug
                  }
                }
              }
            : {})
        }
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
        }
      },
      orderBy: [
        {
          updatedAt: "desc"
        }
      ]
    });

    const topics = await prisma.aITopic.groupBy({
      by: ["slug", "topic"],
      where: {
        status: "active",
        entry: {
          ownerId: userId
        }
      },
      _count: {
        slug: true
      },
      orderBy: {
        _count: {
          slug: "desc"
        }
      },
      take: 25
    });

    return {
      ownerId: userId,
      topicSlug: topicSlug ?? null,
      topics: topics.map((topic) => ({
        slug: topic.slug,
        topic: topic.topic,
        entryCount: topic._count.slug
      })),
      items: items.map(serializeKnowledgeItem)
    };
  }
};
