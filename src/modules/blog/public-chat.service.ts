import { env } from "@/config/env";
import { ApiError } from "@/lib/api";
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
  publishedContent: string;
  publishedAt: string | null;
  score: number;
  snippet: string;
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

function countMatches(haystack: string, tokens: string[]) {
  const normalized = haystack.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (normalized.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function buildSnippet(text: string, tokens: string[]) {
  const compact = text.replace(/\s+/g, " ").trim();

  if (!compact) {
    return "";
  }

  const lowered = compact.toLowerCase();
  const firstHit = tokens
    .map((token) => lowered.indexOf(token))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (firstHit === undefined) {
    return compact.slice(0, 220);
  }

  const start = Math.max(0, firstHit - 90);
  const end = Math.min(compact.length, firstHit + 170);

  return `${start > 0 ? "..." : ""}${compact.slice(start, end).trim()}${end < compact.length ? "..." : ""}`;
}

async function retrievePublicSources(question: string, limit = 5) {
  const tokens = tokenize(question);
  const posts = await prisma.blogPost.findMany({
    where: {
      status: "published"
    },
    orderBy: {
      publishedAt: "desc"
    }
  });

  return posts
    .map((post) => {
      const title = post.title.toLowerCase();
      const description = (post.description ?? "").toLowerCase();
      const content = post.publishedContent.toLowerCase();
      const slug = post.slug.toLowerCase();
      const normalizedQuestion = question.toLowerCase();

      let score = 0;

      if (title.includes(normalizedQuestion)) {
        score += 30;
      }

      if (description.includes(normalizedQuestion)) {
        score += 16;
      }

      if (content.includes(normalizedQuestion)) {
        score += 12;
      }

      if (slug.includes(normalizedQuestion)) {
        score += 10;
      }

      score += countMatches(title, tokens) * 8;
      score += countMatches(description, tokens) * 5;
      score += Math.min(18, countMatches(content, tokens) * 2);
      score += countMatches(slug, tokens) * 4;

      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        description: post.description,
        publishedContent: post.publishedContent,
        publishedAt: post.publishedAt?.toISOString() ?? null,
        score,
        snippet: buildSnippet(post.publishedContent || post.description || post.title, tokens)
      };
    })
    .filter((post) => post.score > 0)
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
        `publishedAt: ${source.publishedAt ?? "-"}`,
        `description: ${source.description ?? "-"}`,
        `snippet: ${source.snippet || "-"}`,
        `content: ${source.publishedContent.slice(0, 3200)}`
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
      temperature: 0.2,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text:
                "You are the public-facing guide for a person's blog. " +
                "Answer strictly from the provided published sources only. " +
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
              text: `Visitor question:\n${question}\n\nPublished sources:\n\n${sourceContext}`
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
        answerMarkdown:
          "Mình chưa tìm thấy thông tin công khai phù hợp trên blog để trả lời câu hỏi này.",
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
