"use client";

import { useState } from "react";
import { renderMarkdownPreview } from "@/lib/markdown-preview";

type WikiSource = {
  entryId: string;
  title: string;
  entryType: string;
  logicalPath: string | null;
  visibility: string;
  excerpt: string | null;
  snippet: string;
  tags: string[];
  aliases: string[];
  blogSlug: string | null;
  updatedAt: string;
  score: number;
};

type WikiQueryResponse = {
  query: string;
  answerMarkdown: string;
  sources: WikiSource[];
  model: string | null;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
};

const sampleQuestions = [
  "What have I written about deep work and distraction?",
  "Summarize my notes related to Karpathy.",
  "What patterns appear across my book notes on focus?"
];

export function WikiQueryPanel() {
  const [query, setQuery] = useState(sampleQuestions[0]);
  const [answer, setAnswer] = useState<WikiQueryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAsk() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/wiki/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          limit: 6
        })
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: WikiQueryResponse;
        error?: {
          message?: string;
        };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "Unable to query the wiki.");
      }

      setAnswer(payload.data);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Unable to query the wiki.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="panel">
      <p className="panel-kicker">Query Your Wiki</p>
      <h2 className="panel-title">Ask across your Markdown knowledge base</h2>
      <p className="muted-copy" style={{ marginTop: 12 }}>
        This MVP retrieves likely entries from PostgreSQL first, then asks the model
        to answer only from those sources with citations.
      </p>

      <label className="label" style={{ marginTop: 18 }}>
        Question
        <textarea
          className="textarea"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="What have I said about attention residue?"
          style={{ minHeight: 120 }}
        />
      </label>

      <div className="button-row" style={{ marginTop: 12 }}>
        <button
          className="button"
          type="button"
          onClick={handleAsk}
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? "Thinking..." : "Ask wiki"}
        </button>
        {sampleQuestions.map((sample) => (
          <button
            className="button-ghost"
            key={sample}
            type="button"
            onClick={() => setQuery(sample)}
            disabled={isLoading}
          >
            {sample}
          </button>
        ))}
      </div>

      <div className={`status ${error ? "error" : ""}`} style={{ marginTop: 12 }}>
        {error}
      </div>

      {answer ? (
        <div className="query-layout" style={{ marginTop: 22 }}>
          <article className="query-answer">
            <div className="meta-row" style={{ marginBottom: 14 }}>
              <span>{answer.model ?? "retrieval only"}</span>
              <span>{answer.sources.length} retrieved sources</span>
              {answer.usage?.total_tokens ? <span>{answer.usage.total_tokens} tokens</span> : null}
            </div>
            <div
              className="preview"
              dangerouslySetInnerHTML={{
                __html: renderMarkdownPreview(answer.answerMarkdown)
              }}
            />
          </article>

          <aside className="query-sources">
            <div className="entry-list">
              {answer.sources.map((source, index) => (
                <article className="entry-card" key={source.entryId}>
                  <div className="meta-row">
                    <span>S{index + 1}</span>
                    <span>{source.entryType}</span>
                    {source.logicalPath ? <span>{source.logicalPath}</span> : null}
                  </div>
                  <h3>{source.title}</h3>
                  {source.excerpt ? <p className="muted-copy">{source.excerpt}</p> : null}
                  <p className="muted-copy">{source.snippet}</p>
                  {source.tags.length > 0 ? (
                    <div className="chip-row">
                      {source.tags.map((tag) => (
                        <span className="chip" key={`${source.entryId}-${tag}`}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="meta-row" style={{ marginTop: 10 }}>
                    <span>score {source.score}</span>
                    <span>{new Date(source.updatedAt).toLocaleString()}</span>
                    {source.blogSlug ? <span>/blog/{source.blogSlug}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
