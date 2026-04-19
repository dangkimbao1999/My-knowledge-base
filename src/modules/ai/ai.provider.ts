import { env } from "@/config/env";
import { ApiError } from "@/lib/api";

export type SummaryOutput = {
  summaryMarkdown: string;
  model: string;
};

export type TopicOutput = {
  topics: string[];
  model: string;
};

export type KnowledgeOutput = {
  items: Array<{
    title: string;
    content: string;
    sourceQuote?: string;
  }>;
  model: string;
};

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
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

async function callResponsesApi<T>(input: {
  instructions: string;
  prompt: string;
  temperature?: number;
  parse: (text: string) => T;
}) {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError("OPENAI_API_KEY is not configured", 500);
  }

  const baseUrl = env.OPENAI_API_BASE.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      temperature: input.temperature ?? env.OPENAI_TEMPERATURE,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: input.instructions
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: input.prompt
            }
          ]
        }
      ]
    })
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new ApiError(payload.error?.message || "AI request failed", response.status);
  }

  const text = extractOutputText(payload);

  if (!text) {
    throw new ApiError("AI model returned an empty response", 502);
  }

  return {
    data: input.parse(text),
    model: env.LLM_MODEL
  };
}

function parseJson<T>(text: string) {
  return JSON.parse(stripCodeFence(text)) as T;
}

export interface AIProvider {
  summarize(input: { entryId: string; text: string; title: string }): Promise<SummaryOutput>;
  extractTopics(input: { entryId: string; text: string; title: string }): Promise<TopicOutput>;
  extractKnowledge(input: {
    entryId: string;
    text: string;
    title: string;
  }): Promise<KnowledgeOutput>;
}

export class OpenAIWikiProvider implements AIProvider {
  async summarize(input: { entryId: string; text: string; title: string }): Promise<SummaryOutput> {
    const result = await callResponsesApi({
      instructions:
        "You summarize a personal knowledge-base entry. Return only Markdown, no JSON. " +
        "Use short sections and stay faithful to the source. Do not add outside knowledge.",
      prompt:
        `Title: ${input.title}\nEntry ID: ${input.entryId}\n\n` +
        `Source text:\n${input.text.slice(0, 14000)}`,
      temperature: 0.1,
      parse: (text) => ({
        summaryMarkdown: text.trim()
      })
    });

    return {
      ...result.data,
      model: result.model
    };
  }

  async extractTopics(input: { entryId: string; text: string; title: string }): Promise<TopicOutput> {
    const result = await callResponsesApi({
      instructions:
        "You extract topics from a personal knowledge-base entry. " +
        "Return valid JSON only with shape {\"topics\":[\"topic one\",\"topic two\"]}. " +
        "Keep 3 to 8 concise topics. No explanations.",
      prompt:
        `Title: ${input.title}\nEntry ID: ${input.entryId}\n\n` +
        `Source text:\n${input.text.slice(0, 12000)}`,
      temperature: 0,
      parse: (text) => parseJson<{ topics?: string[] }>(text)
    });

    return {
      topics: [...new Set((result.data.topics ?? []).map((topic) => topic.trim()).filter(Boolean))],
      model: result.model
    };
  }

  async extractKnowledge(input: {
    entryId: string;
    text: string;
    title: string;
  }): Promise<KnowledgeOutput> {
    const result = await callResponsesApi({
      instructions:
        "You extract durable knowledge items from a personal knowledge-base entry. " +
        "Return valid JSON only with shape {\"items\":[{\"title\":\"...\",\"content\":\"...\",\"sourceQuote\":\"...\"}]}. " +
        "Return 3 to 8 items. Keep each title short, each content specific, and sourceQuote brief.",
      prompt:
        `Title: ${input.title}\nEntry ID: ${input.entryId}\n\n` +
        `Source text:\n${input.text.slice(0, 14000)}`,
      temperature: 0.1,
      parse: (text) =>
        parseJson<{
          items?: Array<{
            title?: string;
            content?: string;
            sourceQuote?: string;
          }>;
        }>(text)
    });

    return {
      items: (result.data.items ?? [])
        .map((item) => ({
          title: item.title?.trim() ?? "",
          content: item.content?.trim() ?? "",
          sourceQuote: item.sourceQuote?.trim() || undefined
        }))
        .filter((item) => item.title && item.content),
      model: result.model
    };
  }
}

export function getAIProvider() {
  return new OpenAIWikiProvider();
}
