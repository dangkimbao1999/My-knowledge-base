import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/modules/ai/ai.provider";
import { refreshEntrySearchDocument } from "@/modules/entries/search-document";
import { jobsService } from "@/modules/jobs/jobs.service";

type ProcessOptions = {
  force?: boolean;
  includeRelations?: boolean;
};

const PROMPT_VERSION = "wiki-pipeline-v1";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hashSnapshot(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function toNullableJsonValue(
  value?: Record<string, unknown>
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function serializeJobLike(job: Awaited<ReturnType<typeof jobsService.getLatestEntryJob>>) {
  return job;
}

async function findOwnedEntry(userId: string, entryId: string) {
  const entry = await prisma.entry.findFirst({
    where: {
      id: entryId,
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
      entryTags: {
        include: {
          tag: true
        }
      },
      outgoingLinks: true,
      aiSummaries: {
        where: {
          status: "active"
        },
        orderBy: {
          version: "desc"
        },
        take: 1
      },
      aiTopics: {
        where: {
          status: "active"
        }
      },
      aiKnowledgeItems: {
        where: {
          status: "active"
        }
      }
    }
  });

  if (!entry) {
    throw new ApiError("Entry not found", 404);
  }

  return entry;
}

async function markEntryState(
  entryId: string,
  state: "queued" | "running" | "completed" | "failed",
  errorMessage?: string | null
) {
  await prisma.entry.update({
    where: {
      id: entryId
    },
    data: {
      processingState: state,
      lastProcessedAt: state === "completed" ? new Date() : undefined,
      lastProcessingError: errorMessage ?? null
    }
  });
}

async function collectArtifactCounts(entryId: string) {
  const [summaryCount, topicCount, knowledgeCount, relationCount] = await Promise.all([
    prisma.aISummary.count({
      where: {
        entryId,
        status: "active"
      }
    }),
    prisma.aITopic.count({
      where: {
        entryId,
        status: "active"
      }
    }),
    prisma.aIKnowledgeItem.count({
      where: {
        entryId,
        status: "active"
      }
    }),
    prisma.entryRelation.count({
      where: {
        sourceEntryId: entryId
      }
    })
  ]);

  return {
    summaries: summaryCount,
    topics: topicCount,
    knowledgeItems: knowledgeCount,
    relations: relationCount
  };
}

async function buildRelations(
  tx: Prisma.TransactionClient,
  input: {
    ownerId: string;
    entryId: string;
    topicSlugs: string[];
    tagNames: string[];
    wikiTargetIds: string[];
  }
) {
  await tx.entryRelation.deleteMany({
    where: {
      sourceEntryId: input.entryId
    }
  });

  const candidates = await tx.entry.findMany({
    where: {
      ownerId: input.ownerId,
      id: {
        not: input.entryId
      }
    },
    select: {
      id: true,
      title: true,
      aiTopics: {
        where: {
          status: "active"
        },
        select: {
          slug: true,
          topic: true
        }
      },
      entryTags: {
        include: {
          tag: true
        }
      }
    }
  });

  const scored = candidates
    .map((candidate) => {
      const sharedTopics = candidate.aiTopics
        .map((topic) => topic.slug)
        .filter((slug) => input.topicSlugs.includes(slug));
      const sharedTags = candidate.entryTags
        .map((item) => item.tag.name.toLowerCase())
        .filter((tag) => input.tagNames.includes(tag));
      const explicitlyLinked = input.wikiTargetIds.includes(candidate.id);
      const score =
        (explicitlyLinked ? 8 : 0) + sharedTopics.length * 4 + sharedTags.length * 2;

      return {
        candidate,
        sharedTopics,
        sharedTags,
        explicitlyLinked,
        score
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  for (const item of scored) {
    const rationaleParts = [];

    if (item.explicitlyLinked) {
      rationaleParts.push("explicit wiki link");
    }

    if (item.sharedTopics.length > 0) {
      rationaleParts.push(`shared topics: ${item.sharedTopics.join(", ")}`);
    }

    if (item.sharedTags.length > 0) {
      rationaleParts.push(`shared tags: ${item.sharedTags.join(", ")}`);
    }

    await tx.entryRelation.create({
      data: {
        sourceEntryId: input.entryId,
        targetEntryId: item.candidate.id,
        relationType: item.explicitlyLinked ? "references" : "related",
        rationale: rationaleParts.join("; "),
        confidence: Math.min(0.98, 0.45 + item.score * 0.04)
      }
    });
  }

  return scored.length;
}

async function persistArtifacts(input: {
  entryId: string;
  ownerId: string;
  plainText: string;
  summaryMarkdown: string;
  summaryModel: string;
  topics: string[];
  topicsModel: string;
  knowledgeItems: Array<{
    title: string;
    content: string;
    sourceQuote?: string;
  }>;
  knowledgeModel: string;
  includeRelations: boolean;
  tagNames: string[];
  wikiTargetIds: string[];
}) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.entry.findUniqueOrThrow({
      where: {
        id: input.entryId
      }
    });

    const nextVersion = entry.latestAIVersion + 1;
    const snapshotHash = hashSnapshot(input.plainText);

    await tx.aISummary.updateMany({
      where: {
        entryId: input.entryId,
        status: "active"
      },
      data: {
        status: "superseded"
      }
    });

    await tx.aITopic.updateMany({
      where: {
        entryId: input.entryId,
        status: "active"
      },
      data: {
        status: "superseded"
      }
    });

    await tx.aIKnowledgeItem.updateMany({
      where: {
        entryId: input.entryId,
        status: "active"
      },
      data: {
        status: "superseded"
      }
    });

    await tx.aISummary.create({
      data: {
        entryId: input.entryId,
        version: nextVersion,
        status: "active",
        summaryMarkdown: input.summaryMarkdown,
        sourceSnapshotHash: snapshotHash,
        modelName: input.summaryModel,
        promptVersion: PROMPT_VERSION
      }
    });

    const dedupedTopics = [...new Set(input.topics.map((topic) => compactText(topic)).filter(Boolean))];

    if (dedupedTopics.length > 0) {
      await tx.aITopic.createMany({
        data: dedupedTopics.map((topic) => ({
          entryId: input.entryId,
          version: nextVersion,
          status: "active",
          topic,
          slug: slugify(topic) || "topic",
          confidence: 0.7,
          sourceSnapshotHash: snapshotHash,
          modelName: input.topicsModel,
          promptVersion: PROMPT_VERSION
        }))
      });
    }

    if (input.knowledgeItems.length > 0) {
      await tx.aIKnowledgeItem.createMany({
        data: input.knowledgeItems.map((item, index) => ({
          entryId: input.entryId,
          version: nextVersion,
          status: "active",
          title: item.title,
          content: item.content,
          sourceChunkId: `raw_text:${index + 1}`,
          sourceReferences: item.sourceQuote
            ? toNullableJsonValue({
                quote: item.sourceQuote
              })
            : undefined,
          sourceSnapshotHash: snapshotHash,
          modelName: input.knowledgeModel,
          promptVersion: PROMPT_VERSION
        }))
      });
    }

    const relationCount = input.includeRelations
      ? await buildRelations(tx, {
          ownerId: input.ownerId,
          entryId: input.entryId,
          topicSlugs: dedupedTopics.map((topic) => slugify(topic)).filter(Boolean),
          tagNames: input.tagNames,
          wikiTargetIds: input.wikiTargetIds
        })
      : 0;

    await tx.entry.update({
      where: {
        id: input.entryId
      },
      data: {
        latestAIVersion: nextVersion,
        processingState: "completed",
        lastProcessedAt: new Date(),
        lastProcessingError: null
      }
    });

    await refreshEntrySearchDocument(tx, input.entryId);

    return {
      version: nextVersion,
      relationCount
    };
  });
}

async function runTextEntryPipeline(userId: string, entryId: string, options: ProcessOptions) {
  const entry = await findOwnedEntry(userId, entryId);

  if (entry.entryType === "book" && entry.textSources.length === 0) {
    throw new ApiError("Book processing requires extracted text, which is not implemented yet.", 400);
  }

  const latestTextSource = entry.textSources[0];
  const plainText = compactText(latestTextSource?.plainText ?? latestTextSource?.content ?? "");

  if (!plainText) {
    throw new ApiError("Entry has no processable text source", 400);
  }

  if (!options.force && entry.aiSummaries.length > 0) {
    return {
      skipped: true,
      reason: "Entry already has active AI artifacts. Reprocess with force=true if needed."
    };
  }

  const ai = getAIProvider();
  const [summary, topics, knowledge] = await Promise.all([
    ai.summarize({
      entryId: entry.id,
      title: entry.title,
      text: plainText
    }),
    ai.extractTopics({
      entryId: entry.id,
      title: entry.title,
      text: plainText
    }),
    ai.extractKnowledge({
      entryId: entry.id,
      title: entry.title,
      text: plainText
    })
  ]);

  const persisted = await persistArtifacts({
    entryId: entry.id,
    ownerId: userId,
    plainText,
    summaryMarkdown: summary.summaryMarkdown,
    summaryModel: summary.model,
    topics: topics.topics,
    topicsModel: topics.model,
    knowledgeItems: knowledge.items,
    knowledgeModel: knowledge.model,
    includeRelations: options.includeRelations ?? true,
    tagNames: entry.entryTags.map((item) => item.tag.name.toLowerCase()),
    wikiTargetIds: entry.outgoingLinks
      .map((link) => link.targetEntryId)
      .filter((value): value is string => Boolean(value))
  });

  return {
    skipped: false,
    version: persisted.version,
    summaryLength: summary.summaryMarkdown.length,
    topicCount: topics.topics.length,
    knowledgeCount: knowledge.items.length,
    relationCount: persisted.relationCount
  };
}

export const processingService = {
  async processEntry(userId: string, entryId: string, options: ProcessOptions) {
    await findOwnedEntry(userId, entryId);

    const job = await jobsService.createJob({
      ownerId: userId,
      entryId,
      jobType: "process_entry",
      triggeredBy: "manual",
      payload: {
        force: options.force ?? false,
        includeRelations: options.includeRelations ?? true
      }
    });

    await markEntryState(entryId, "queued");
    await jobsService.markRunning(job.id);
    await markEntryState(entryId, "running");

    try {
      const result = await runTextEntryPipeline(userId, entryId, options);
      const artifacts = await collectArtifactCounts(entryId);
      const completedJob = await jobsService.markCompleted(job.id, {
        ...result,
        artifacts
      });

      return {
        entryId,
        ownerId: userId,
        currentState: "completed",
        latestJob: completedJob,
        result,
        artifacts
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Entry processing failed";
      await markEntryState(entryId, "failed", message);
      const failedJob = await jobsService.markFailed(job.id, message);
      throw new ApiError(message, 400, {
        entryId,
        latestJob: failedJob
      });
    }
  },

  async reprocessEntry(userId: string, entryId: string) {
    return this.processEntry(userId, entryId, {
      force: true,
      includeRelations: true
    });
  },

  async getProcessingStatus(userId: string, entryId: string) {
    const entry = await prisma.entry.findFirst({
      where: {
        id: entryId,
        ownerId: userId
      },
      select: {
        id: true,
        processingState: true,
        lastProcessedAt: true,
        lastProcessingError: true,
        latestAIVersion: true
      }
    });

    if (!entry) {
      throw new ApiError("Entry not found", 404);
    }

    const [latestJob, artifacts] = await Promise.all([
      jobsService.getLatestEntryJob(userId, entryId),
      collectArtifactCounts(entryId)
    ]);

    return {
      entryId,
      ownerId: userId,
      currentState: entry.processingState,
      latestAIVersion: entry.latestAIVersion,
      lastProcessedAt: entry.lastProcessedAt?.toISOString() ?? null,
      lastProcessingError: entry.lastProcessingError,
      latestJob: serializeJobLike(latestJob),
      artifacts
    };
  },

  async processEntryById(entryId: string) {
    const entry = await prisma.entry.findUnique({
      where: {
        id: entryId
      },
      select: {
        ownerId: true
      }
    });

    if (!entry) {
      throw new ApiError("Entry not found", 404);
    }

    return this.processEntry(entry.ownerId, entryId, {
      force: true,
      includeRelations: true
    });
  },

  async extractPdfText(fileId: string) {
    return {
      fileId,
      extracted: false,
      message: "PDF extraction is intentionally deferred in the current milestone."
    };
  },

  async generateSummary(entryId: string) {
    const entry = await prisma.entry.findUnique({
      where: {
        id: entryId
      },
      select: {
        ownerId: true
      }
    });

    if (!entry) {
      throw new ApiError("Entry not found", 404);
    }

    return this.processEntry(entry.ownerId, entryId, {
      force: true,
      includeRelations: false
    });
  },

  async extractKnowledge(entryId: string) {
    const entry = await prisma.entry.findUnique({
      where: {
        id: entryId
      },
      select: {
        ownerId: true
      }
    });

    if (!entry) {
      throw new ApiError("Entry not found", 404);
    }

    return this.processEntry(entry.ownerId, entryId, {
      force: true,
      includeRelations: true
    });
  },

  async linkRelatedEntries(entryId: string) {
    const entry = await prisma.entry.findUnique({
      where: {
        id: entryId
      },
      select: {
        ownerId: true
      }
    });

    if (!entry) {
      throw new ApiError("Entry not found", 404);
    }

    return this.processEntry(entry.ownerId, entryId, {
      force: true,
      includeRelations: true
    });
  }
};
