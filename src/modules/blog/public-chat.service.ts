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

  if (slug.includes(normalizedQuestion)) {
    score += 10;
  }

  score += countMatches(title, tokens) * 8;
  score += countMatches(description, tokens) * 5;
  score += Math.min(24, countMatches(chunkText, tokens) * 3);
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
      publishedAt: true
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
      snippet: buildSnippet(chunk.content || post.description || post.title, tokens)
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
                "Answer strictly from the provided published source chunks only. " +
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
