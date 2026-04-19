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
  "Bạn là ai và bạn đang public những chủ đề nào?",
  "Tóm tắt nhanh những gì quan trọng nhất từ blog này.",
  "Nếu tôi mới vào blog, tôi nên đọc bài nào trước?"
];

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

  return (
    <section className="blog-chat-panel">
      <div className="blog-chat-header">
        <div>
          <div className="blog-kicker">public interface</div>
          <h2 className="blog-chat-title">ASK_THE_PUBLIC_KERNEL</h2>
          <p className="blog-terminal-output">
            Visitor có thể hỏi về anh dựa trên những gì anh đã public. Chatbot này chỉ đọc từ các public nodes.
          </p>
        </div>
        <div className="blog-chat-badge">PUBLIC_ONLY</div>
      </div>

      <label className="blog-chat-label">
        VISITOR_QUERY
        <textarea
          className="blog-chat-input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Hỏi về những gì blog này đã public..."
        />
      </label>

      <div className="blog-chat-actions">
        <button
          className="blog-chat-button"
          type="button"
          onClick={handleAsk}
          disabled={isLoading || !question.trim()}
        >
          {isLoading ? "PROCESSING..." : "QUERY_PUBLIC_BRAIN"}
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
              dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(result.answerMarkdown) }}
            />
          </article>

          <aside className="blog-chat-sources">
            <div className="blog-side-card">
              <h3 className="blog-side-card-title">Public sources used</h3>
              <div className="blog-other-posts">
                {result.sources.map((source, index) => (
                  <a className="blog-other-post" href={`/blog/${source.slug}`} key={source.id}>
                    <h4 className="blog-other-post-title">
                      S{index + 1} // {source.title}
                    </h4>
                    <div className="blog-terminal-output">{source.snippet}</div>
                    <div className="blog-other-post-meta">
                      {source.publishedAt ? new Date(source.publishedAt).toLocaleString("vi-VN") : "published"}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
