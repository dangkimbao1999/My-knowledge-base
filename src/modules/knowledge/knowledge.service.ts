import { ApiError } from "@/lib/api";
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
    blogPost?: {
      slug: string;
      status: string;
    } | null;
  };
  sourceChunk: {
    id: string;
    chunkIndex: number;
    content: string;
    startOffset: number;
    endOffset: number;
  } | null;
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
      visibility: item.entry.visibility,
      blogSlug: item.entry.blogPost?.status === "published" ? item.entry.blogPost.slug : null
    },
    evidence: item.sourceChunk
      ? {
          sourceChunkId: item.sourceChunk.id,
          chunkIndex: item.sourceChunk.chunkIndex,
          startOffset: item.sourceChunk.startOffset,
          endOffset: item.sourceChunk.endOffset,
          snippet: item.sourceChunk.content.slice(0, 400)
        }
      : null
  };
}

function serializeClaim(item: {
  id: string;
  claimType: string;
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
  sourceChunk: {
    id: string;
    chunkIndex: number;
    content: string;
    startOffset: number;
    endOffset: number;
  } | null;
  claimEntities: Array<{
    entity: {
      id: string;
      name: string;
      slug: string;
      entityType: string | null;
    };
  }>;
}) {
  return {
    id: item.id,
    claimType: item.claimType,
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
    },
    entities: item.claimEntities.map((claimEntity) => ({
      id: claimEntity.entity.id,
      name: claimEntity.entity.name,
      slug: claimEntity.entity.slug,
      entityType: claimEntity.entity.entityType
    })),
    evidence: item.sourceChunk
      ? {
          sourceChunkId: item.sourceChunk.id,
          chunkIndex: item.sourceChunk.chunkIndex,
          startOffset: item.sourceChunk.startOffset,
          endOffset: item.sourceChunk.endOffset,
          snippet: item.sourceChunk.content.slice(0, 400)
        }
      : null
  };
}

function serializeTopicOverview(topic: {
  slug: string;
  topic: string;
  entryCount: number;
}) {
  return {
    slug: topic.slug,
    topic: topic.topic,
    entryCount: topic.entryCount
  };
}

function serializeEntityOverview(entity: {
  id: string;
  name: string;
  slug: string;
  entityType: string | null;
  claimCount: number;
}) {
  return {
    id: entity.id,
    name: entity.name,
    slug: entity.slug,
    entityType: entity.entityType,
    claimCount: entity.claimCount
  };
}

export const knowledgeService = {
  async listKnowledge(userId: string, topicSlug?: string) {
    const [items, claims, topics, entities] = await Promise.all([
      prisma.aIKnowledgeItem.findMany({
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
              visibility: true,
              blogPost: {
                select: {
                  slug: true,
                  status: true
                }
              }
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
        orderBy: [
          {
            updatedAt: "desc"
          }
        ]
      }),
      prisma.knowledgeClaim.findMany({
        where: {
          status: "active",
          ownerId: userId,
          entry: {
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
        orderBy: [
          {
            updatedAt: "desc"
          }
        ],
        take: 80
      }),
      prisma.aITopic.groupBy({
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
      }),
      prisma.entity.findMany({
        where: {
          ownerId: userId,
          ...(topicSlug
            ? {
                claimEntities: {
                  some: {
                    claim: {
                      status: "active",
                      entry: {
                        aiTopics: {
                          some: {
                            status: "active",
                            slug: topicSlug
                          }
                        }
                      }
                    }
                  }
                }
              }
            : {})
        },
        include: {
          _count: {
            select: {
              claimEntities: true
            }
          }
        },
        orderBy: {
          claimEntities: {
            _count: "desc"
          }
        },
        take: 30
      })
    ]);

    return {
      ownerId: userId,
      topicSlug: topicSlug ?? null,
      topics: topics.map((topic) =>
        serializeTopicOverview({
          slug: topic.slug,
          topic: topic.topic,
          entryCount: topic._count.slug
        })
      ),
      items: items.map(serializeKnowledgeItem),
      claims: claims.map(serializeClaim),
      entities: entities.map((entity) =>
        serializeEntityOverview({
          id: entity.id,
          name: entity.name,
          slug: entity.slug,
          entityType: entity.entityType,
          claimCount: entity._count.claimEntities
        })
      )
    };
  },

  async getTopicDetail(userId: string, topicSlug: string) {
    const topicRows = await prisma.aITopic.findMany({
      where: {
        status: "active",
        slug: topicSlug,
        entry: {
          ownerId: userId,
          archivedAt: null
        }
      },
      include: {
        entry: {
          select: {
            id: true,
            title: true,
            entryType: true,
            logicalPath: true,
            excerpt: true,
            visibility: true,
            updatedAt: true,
            blogPost: {
              select: {
                slug: true,
                status: true
              }
            },
            aiKnowledgeItems: {
              where: {
                status: "active"
              },
              select: {
                id: true,
                title: true
              },
              take: 8
            },
            knowledgeClaims: {
              where: {
                status: "active"
              },
              select: {
                id: true
              }
            },
            outgoingRelations: {
              select: {
                targetEntryId: true
              }
            },
            incomingRelations: {
              select: {
                sourceEntryId: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (topicRows.length === 0) {
      throw new ApiError("Topic not found", 404);
    }

    const canonicalTopic = topicRows[0];
    const entryIds = [...new Set(topicRows.map((row) => row.entry.id))];

    const [knowledgeItems, claims, relatedTopics, entities] = await Promise.all([
      prisma.aIKnowledgeItem.findMany({
        where: {
          status: "active",
          entryId: {
            in: entryIds
          }
        },
        include: {
          entry: {
            select: {
              id: true,
              title: true,
              entryType: true,
              logicalPath: true,
              visibility: true,
              blogPost: {
                select: {
                  slug: true,
                  status: true
                }
              }
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
        take: 40
      }),
      prisma.knowledgeClaim.findMany({
        where: {
          status: "active",
          ownerId: userId,
          entryId: {
            in: entryIds
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
        take: 60
      }),
      prisma.aITopic.groupBy({
        by: ["slug", "topic"],
        where: {
          status: "active",
          slug: {
            not: topicSlug
          },
          entryId: {
            in: entryIds
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
        take: 12
      }),
      prisma.entity.findMany({
        where: {
          ownerId: userId,
          claimEntities: {
            some: {
              claim: {
                status: "active",
                entryId: {
                  in: entryIds
                }
              }
            }
          }
        },
        include: {
          _count: {
            select: {
              claimEntities: true
            }
          }
        },
        orderBy: {
          claimEntities: {
            _count: "desc"
          }
        },
        take: 24
      })
    ]);

    const entries = topicRows.map((row) => ({
      id: row.entry.id,
      title: row.entry.title,
      entryType: row.entry.entryType,
      logicalPath: row.entry.logicalPath,
      excerpt: row.entry.excerpt,
      visibility: row.entry.visibility,
      updatedAt: row.entry.updatedAt.toISOString(),
      blogSlug: row.entry.blogPost?.status === "published" ? row.entry.blogPost.slug : null,
      knowledgeCount: row.entry.aiKnowledgeItems.length,
      claimCount: row.entry.knowledgeClaims.length,
      relationCount: row.entry.outgoingRelations.length + row.entry.incomingRelations.length,
      evidenceTitles: row.entry.aiKnowledgeItems.map((item) => item.title)
    }));

    return {
      ownerId: userId,
      topic: {
        slug: canonicalTopic.slug,
        topic: canonicalTopic.topic,
        entryCount: entryIds.length,
        knowledgeCount: knowledgeItems.length,
        claimCount: claims.length,
        entityCount: entities.length
      },
      entries,
      knowledgeItems: knowledgeItems.map(serializeKnowledgeItem),
      claims: claims.map(serializeClaim),
      entities: entities.map((entity) =>
        serializeEntityOverview({
          id: entity.id,
          name: entity.name,
          slug: entity.slug,
          entityType: entity.entityType,
          claimCount: entity._count.claimEntities
        })
      ),
      relatedTopics: relatedTopics.map((topic) =>
        serializeTopicOverview({
          slug: topic.slug,
          topic: topic.topic,
          entryCount: topic._count.slug
        })
      )
    };
  }
};
