import { env } from "@/config/env";
import { ApiError } from "@/lib/api";
import { retrieveWikiSources } from "@/modules/search/wiki-retrieval";

type QueryWikiInput = {
  query: string;
  limit?: number;
};

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
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

function buildSourceContext(sources: Awaited<ReturnType<typeof retrieveWikiSources>>) {
  return sources
    .map((source, index) => {
      const ref = `S${index + 1}`;

      return [
        `[${ref}] ${source.title}`,
        `entryType: ${source.entryType}`,
        `sourceType: ${source.sourceType}`,
        `chunkIndex: ${source.chunkIndex}`,
        `logicalPath: ${source.logicalPath ?? "-"}`,
        `tags: ${source.tags.join(", ") || "-"}`,
        `updatedAt: ${source.updatedAt}`,
        `excerpt: ${source.excerpt ?? "-"}`,
        `snippet: ${source.snippet || "-"}`,
        `knowledge evidence: ${
          source.evidence.map((item) => `${item.title}: ${item.content}`).join(" | ") || "-"
        }`,
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
        `source chunk: ${source.chunkText.slice(0, 2400) || "-"}`
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function extractOutputText(payload: OpenAIResponsePayload) {
  if (payload.output_text?.trim()) {
    return payload.output_text.trim();
  }

  const fragments =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" || item.type === "text")
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean) ?? [];

  return fragments.join("\n\n").trim();
}

async function generateWikiAnswer(query: string, sourceContext: string) {
  const baseUrl = env.OPENAI_API_BASE.replace(/\/+$/, "");
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
                "You answer questions only from the provided personal wiki source chunks and evidence. " +
                "Treat source chunks as authoritative and extracted knowledge as supporting structure only. " +
                "Do not use outside knowledge. If the sources are insufficient, say so clearly. " +
                "Respond in the same language as the user. Format the answer in Markdown. " +
                "Cite supporting sources inline with brackets like [S1]. End with a short `Sources` list."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Question:\n${query}\n\nAvailable sources:\n\n${sourceContext}`
            }
          ]
        }
      ]
    })
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new ApiError(payload.error?.message || "OpenAI query request failed", response.status);
  }

  const answer = extractOutputText(payload);

  if (!answer) {
    throw new ApiError("Model returned an empty wiki answer", 502);
  }

  return {
    answer,
    usage: payload.usage ?? null
  };
}

export const wikiQueryService = {
  async query(userId: string, input: QueryWikiInput) {
    if (!env.OPENAI_API_KEY) {
      throw new ApiError("OPENAI_API_KEY is not configured", 500);
    }

    const sources = await retrieveWikiSources({
      userId,
      query: input.query,
      limit: input.limit ?? 6
    });

    if (sources.length === 0) {
      return {
        query: input.query,
        answerMarkdown: "Chưa tìm thấy source chunk nào đủ liên quan trong wiki cho câu hỏi này.",
        sources: [],
        model: null,
        usage: null
      };
    }

    const sourceContext = buildSourceContext(sources);
    const result = await generateWikiAnswer(input.query, sourceContext);

    return {
      query: input.query,
      answerMarkdown: result.answer,
      sources,
      model: env.LLM_MODEL,
      usage: result.usage
    };
  }
};
