import type { Prisma } from "@/generated/prisma";

type PrismaExecutor = Prisma.TransactionClient;

function joinNonEmpty(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join("\n");
}

export async function refreshEntrySearchDocument(
  tx: PrismaExecutor,
  entryId: string
) {
  const entry = await tx.entry.findUniqueOrThrow({
    where: {
      id: entryId
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
      notes: {
        orderBy: {
          updatedAt: "desc"
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
      knowledgeClaims: {
        where: {
          status: "active"
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 24,
        include: {
          claimEntities: {
            include: {
              entity: {
                select: {
                  name: true,
                  slug: true
                }
              }
            }
          }
        }
      },
      aiTopics: {
        where: {
          status: "active"
        },
        orderBy: {
          topic: "asc"
        }
      }
    }
  });

  const latestTextSource = entry.textSources[0] ?? null;
  const summary = entry.aiSummaries[0]?.summaryMarkdown ?? "";

  const searchDocument = joinNonEmpty([
    entry.title,
    entry.excerpt,
    entry.logicalPath,
    entry.author,
    entry.aliases.join("\n"),
    entry.entryTags.map((item) => item.tag.name).join("\n"),
    entry.aiTopics.map((topic) => `${topic.topic}\n${topic.slug}`).join("\n"),
    latestTextSource?.plainText ?? latestTextSource?.content,
    entry.notes
      .map((note) => joinNonEmpty([note.noteType, note.title, note.chapterLabel, note.content]))
      .join("\n"),
    summary,
    entry.knowledgeClaims
      .map((item) =>
        joinNonEmpty([
          item.claimType,
          item.content,
          item.claimEntities
            .map((claimEntity) => joinNonEmpty([claimEntity.entity.name, claimEntity.entity.slug]))
            .join("\n")
        ])
      )
      .join("\n"),
    entry.outgoingLinks
      .map((link) => joinNonEmpty([link.targetTitle, link.linkText]))
      .join("\n")
  ]);

  await tx.entry.update({
    where: {
      id: entryId
    },
    data: {
      searchDocument
    }
  });

  return searchDocument;
}
