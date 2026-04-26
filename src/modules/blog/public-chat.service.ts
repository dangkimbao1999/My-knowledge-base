import { env } from "@/config/env";
import { ApiError } from "@/lib/api";
import { buildSnippet, countMatches, splitIntoSourceChunks, tokenize } from "@/lib/retrieval";
import { prisma } from "@/lib/prisma";

type QueryPublicBlogInput = {
  question: string;
  limit?: number;
};

type PublicBlogSource = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  score: number;
  snippet: string;
  sourceType: "published_chunk";
  chunkIndex: number;
  chunkText: string;
  summary: string | null;
  topics: string[];
  claims: Array<{
    id: string;
    claimType: string;
    content: string;
    entities: Array<{
      name: string;
      slug: string;
    }>;
  }>;
};

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

function scorePublishedChunk(
  post: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    publishedContent: string;
    publishedAt: Date | null;
    entry: {
      publishMode: string;
      aiSummaries: Array<{
        summaryMarkdown: string;
      }>;
      aiTopics: Array<{
        topic: string;
        slug: string;
      }>;
      knowledgeClaims: Array<{
        claimType: string;
        content: string;
        claimEntities: Array<{
          entity: {
            name: string;
            slug: string;
          };
        }>;
      }>;
    };
  },
  chunk: {
    chunkIndex: number;
    content: string;
  },
  question: string,
  tokens: string[]
) {
  const title = post.title.toLowerCase();
  const description = (post.description ?? "").toLowerCase();
  const chunkText = chunk.content.toLowerCase();
  const slug = post.slug.toLowerCase();
  const publishMode = post.entry.publishMode;
  const summaryText =
    publishMode === "summary_only" || publishMode === "summary_and_notes"
      ? (post.entry.aiSummaries[0]?.summaryMarkdown ?? "").toLowerCase()
      : "";
  const topicText =
    publishMode === "summary_only"
      ? ""
      : post.entry.aiTopics
          .map((item) => `${item.topic} ${item.slug}`)
          .join(" ")
          .toLowerCase();
  const claimText =
    publishMode === "summary_only"
      ? ""
      : post.entry.knowledgeClaims
          .map(
            (item) =>
              `${item.claimType} ${item.content} ${item.claimEntities
                .map((claimEntity) => `${claimEntity.entity.name} ${claimEntity.entity.slug}`)
                .join(" ")}`
          )
          .join(" ")
          .toLowerCase();
  const normalizedQuestion = question.toLowerCase();

  let score = 0;

  if (title.includes(normalizedQuestion)) {
    score += 28;
  }

  if (description.includes(normalizedQuestion)) {
    score += 18;
  }

  if (chunkText.includes(normalizedQuestion)) {
    score += 22;
  }

  if (summaryText.includes(normalizedQuestion)) {
    score += 14;
  }

  if (topicText.includes(normalizedQuestion)) {
    score += 10;
  }

  if (claimText.includes(normalizedQuestion)) {
    score += 14;
  }

  if (slug.includes(normalizedQuestion)) {
    score += 10;
  }

  score += countMatches(title, tokens) * 8;
  score += countMatches(description, tokens) * 5;
  score += Math.min(24, countMatches(chunkText, tokens) * 3);
  score += Math.min(12, countMatches(summaryText, tokens) * 2);
  score += Math.min(10, countMatches(topicText, tokens) * 2);
  score += Math.min(12, countMatches(claimText, tokens) * 2);
  score += countMatches(slug, tokens) * 4;

  return score;
}

async function retrievePublicSources(question: string, limit = 5) {
  const tokens = tokenize(question);
  const posts = await prisma.blogPost.findMany({
    where: {
      status: "published"
    },
    orderBy: {
      publishedAt: "desc"
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      publishedContent: true,
      publishedAt: true,
      entry: {
        select: {
          publishMode: true,
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
          knowledgeClaims: {
            where: {
              status: "active"
            },
            select: {
              id: true,
              claimType: true,
              content: true,
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
            take: 8
          }
        }
      }
    }
  });

  const rankedChunks = posts.flatMap((post) =>
    splitIntoSourceChunks(post.publishedContent, {
      maxChars: 1600,
      overlapChars: 220,
      minChars: 260
    }).map((chunk) => ({
      id: `${post.id}:${chunk.chunkIndex}`,
      slug: post.slug,
      title: post.title,
      description: post.description,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      chunkIndex: chunk.chunkIndex,
      chunkText: chunk.content,
      sourceType: "published_chunk" as const,
      score: scorePublishedChunk(post, chunk, question, tokens),
      snippet: buildSnippet(chunk.content || post.description || post.title, tokens),
      summary:
        post.entry.publishMode === "summary_only" || post.entry.publishMode === "summary_and_notes"
          ? post.entry.aiSummaries[0]?.summaryMarkdown ?? null
          : null,
      topics:
        post.entry.publishMode === "summary_only"
          ? []
          : post.entry.aiTopics.map((item) => item.topic),
      claims:
        post.entry.publishMode === "summary_only"
          ? []
          : post.entry.knowledgeClaims.map((item) => ({
              id: item.id,
              claimType: item.claimType,
              content: item.content,
              entities: item.claimEntities.map((claimEntity) => ({
                name: claimEntity.entity.name,
                slug: claimEntity.entity.slug
              }))
            }))
    }))
  );

  return rankedChunks
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function extractOutputText(payload: OpenAIResponsePayload) {
  if (payload.output_text?.trim()) {
    return payload.output_text.trim();
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n")
      .trim() ?? ""
  );
}

async function generatePublicBlogAnswer(question: string, sources: PublicBlogSource[]) {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError("OPENAI_API_KEY is not configured", 500);
  }

  const baseUrl = env.OPENAI_API_BASE.replace(/\/+$/, "");
  const sourceContext = sources
    .map((source, index) => {
      const ref = `S${index + 1}`;

      return [
        `[${ref}] ${source.title}`,
        `slug: ${source.slug}`,
        `sourceType: ${source.sourceType}`,
        `chunkIndex: ${source.chunkIndex}`,
        `publishedAt: ${source.publishedAt ?? "-"}`,
        `description: ${source.description ?? "-"}`,
        `topics: ${source.topics.join(", ") || "-"}`,
        `summary: ${source.summary ? source.summary.slice(0, 1200) : "-"}`,
        `claims: ${
          source.claims
            .map(
              (item) =>
                `${item.claimType}: ${item.content}${
                  item.entities.length > 0
                    ? ` [entities: ${item.entities.map((entity) => entity.name).join(", ")}]`
                    : ""
                }`
            )
            .join(" | ") || "-"
        }`,
        `snippet: ${source.snippet || "-"}`,
        `published chunk: ${source.chunkText.slice(0, 2600)}`
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      temperature: env.OPENAI_TEMPERATURE,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text:
                "You are the public-facing guide for a person's blog. " +
                "Answer strictly from the provided published source chunks and their public-safe supporting structure only. " +
                "Treat published chunks as authoritative. Treat published summaries, topics, and claims as supporting context only. " +
                "If any supporting structure conflicts with the published chunk, trust the chunk text. " +
                "Never use private information, outside knowledge, or infer facts not supported by the public text. " +
                "If the public material is insufficient, say that clearly. " +
                "Respond in the same language as the visitor. " +
                "Format the answer in Markdown and cite sources inline like [S1]. End with a short `Public sources` list."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Visitor question:\n${question}\n\nPublished source chunks:\n\n${sourceContext}`
            }
          ]
        }
      ]
    })
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new ApiError(payload.error?.message || "Public blog chat failed", response.status);
  }

  const answer = extractOutputText(payload);

  if (!answer) {
    throw new ApiError("Model returned an empty blog answer", 502);
  }

  return {
    answer,
    usage: payload.usage ?? null
  };
}

export const publicBlogChatService = {
  async query(input: QueryPublicBlogInput) {
    const sources = await retrievePublicSources(input.question, input.limit ?? 5);

    if (sources.length === 0) {
      return {
        question: input.question,
        answerMarkdown: "Mình chưa tìm thấy thông tin công khai đủ liên quan trên blog để trả lời câu hỏi này.",
        sources: [],
        model: null,
        usage: null
      };
    }

    const result = await generatePublicBlogAnswer(input.question, sources);

    return {
      question: input.question,
      answerMarkdown: result.answer,
      sources,
      model: env.LLM_MODEL,
      usage: result.usage
    };
  }
};
