"use client";

import { useState } from "react";
import { renderMarkdownPreview } from "@/lib/markdown-preview";

type PublicBlogSource = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  score: number;
  snippet: string;
};

type PublicBlogChatResponse = {
  question: string;
  answerMarkdown: string;
  sources: PublicBlogSource[];
  model: string | null;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
};

const starterQuestions = [
  "Bạn là ai, bạn là người như thế nào và tại sao bạn lại làm blog này",
  "Tóm tắt nhanh những gì quan trọng trong blog này",
  "Neu toi moi vao day, toi nen doc bai nao truoc?"
];

function stripTrailingSourcesSection(markdown: string) {
  return markdown
    .replace(/\n+#{0,3}\s*Public sources\s*[\s\S]*$/i, "")
    .replace(/\n+Public sources\s*[\s\S]*$/i, "")
    .trim();
}

function extractCitedSourceIndices(markdown: string) {
  const matches = [...markdown.matchAll(/\[S(\d+)\]/g)];
  return [...new Set(matches.map((match) => Number.parseInt(match[1] ?? "", 10)).filter(Number.isFinite))];
}

export function PublicBlogChat() {
  const [question, setQuestion] = useState(starterQuestions[0]);
  const [result, setResult] = useState<PublicBlogChatResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAsk() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/blog/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          limit: 5
        })
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: PublicBlogChatResponse;
        error?: {
          message?: string;
        };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "Unable to query public blog.");
      }

      setResult(payload.data);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Unable to query public blog.");
    } finally {
      setIsLoading(false);
    }
  }

  const cleanedAnswerMarkdown = result ? stripTrailingSourcesSection(result.answerMarkdown) : "";
  const citedSourceIndices = result ? extractCitedSourceIndices(cleanedAnswerMarkdown) : [];
  const relatedSources = result
    ? (citedSourceIndices.length > 0
        ? citedSourceIndices
            .map((index) => ({ index, source: result.sources[index - 1] }))
            .filter((item): item is { index: number; source: PublicBlogSource } => Boolean(item.source))
        : result.sources.slice(0, 3).map((source, index) => ({ index: index + 1, source })))
    : [];

  return (
    <section className="blog-chat-panel">
      <div className="blog-chat-header">
        <div>
          <div className="blog-section-tag">Connect</div>
          <h2 className="blog-chat-title">Ask me anything</h2>
          <p className="blog-chat-copy">
            Tôi share mọi thứ về tôi, hãy thử hỏi tôi vài câu xem :D
          </p>
        </div>
        {/* <div className="blog-chat-badge">Public Only</div> */}
      </div>

      <label className="blog-chat-label">
        Visitor Query
        <textarea
          className="blog-chat-input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Hoi ve nhung gi blog nay da public..."
        />
      </label>

      <div className="blog-chat-actions">
        <button
          className="blog-primary-button"
          type="button"
          onClick={handleAsk}
          disabled={isLoading || !question.trim()}
        >
          {isLoading ? "Processing..." : "Query Public Brain"}
        </button>

        <div className="blog-chat-suggestions">
          {starterQuestions.map((item) => (
            <button
              className="blog-chat-suggestion"
              key={item}
              type="button"
              onClick={() => setQuestion(item)}
              disabled={isLoading}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="blog-chat-error">{error}</div> : null}

      {result ? (
        <div className="blog-chat-result">
          <article className="blog-chat-answer">
            <div className="blog-chat-answer-meta">
              <span>{result.model ?? "retrieval-only"}</span>
              <span>{result.sources.length} public sources</span>
              {result.usage?.total_tokens ? <span>{result.usage.total_tokens} tokens</span> : null}
            </div>
            <div
              className="preview blog-article-preview"
              style={{ minHeight: "auto" }}
              dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(cleanedAnswerMarkdown) }}
            />

            {relatedSources.length > 0 ? (
              <div className="blog-side-card">
                <h3 className="blog-side-card-title">Public sources</h3>
                <div className="blog-other-posts">
                  {relatedSources.map(({ index, source }) => (
                    <a className="blog-other-post" href={`/blog/${source.slug}`} key={source.id}>
                      <h4 className="blog-other-post-title">
                        S{index} // {source.title}
                      </h4>
                      <div className="blog-recent-description">{source.snippet}</div>
                      <div className="blog-other-post-meta">
                        {source.publishedAt ? new Date(source.publishedAt).toLocaleString("vi-VN") : "published"}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
