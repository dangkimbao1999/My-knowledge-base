"use client";

import { useState } from "react";
import { renderMarkdownPreview } from "@/lib/markdown-preview";

type EntryCard = {
  id: string;
  title: string;
  entryType: string;
  excerpt: string | null;
  logicalPath: string | null;
  tags: string[];
  aliases: string[];
  wikiLinks: Array<{
    targetTitle: string;
    targetEntryId: string | null;
    linkText: string | null;
  }>;
  visibility: string;
  publishMode: string;
  blogPost: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    status: string;
    publishedAt: string | null;
  } | null;
  updatedAt: string;
};

type EntryEditorProps = {
  initialEntries: EntryCard[];
};

const initialMarkdown = `# First thought

**Summary**: One sentence that tells future-you why this matters.

## Notes

- Capture the idea cleanly.
- Link related material like [[Deep Work]].
- Keep each entry focused on one theme.

## Related

- [[Atomic Habits]]
`;

export function EntryEditor({ initialEntries }: EntryEditorProps) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [logicalPath, setLogicalPath] = useState("inbox");
  const [aliases, setAliases] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState(initialMarkdown);
  const [entries, setEntries] = useState(initialEntries);
  const [publishDrafts, setPublishDrafts] = useState<Record<string, {
    slug: string;
    title: string;
    description: string;
    publishMode: string;
  }>>({});
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishingEntryId, setPublishingEntryId] = useState<string | null>(null);

  function createSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getPublishDraft(entry: EntryCard) {
    return (
      publishDrafts[entry.id] ?? {
        slug: entry.blogPost?.slug ?? createSlug(entry.title),
        title: entry.blogPost?.title ?? entry.title,
        description: entry.blogPost?.description ?? entry.excerpt ?? "",
        publishMode: entry.publishMode === "none" ? "notes_only" : entry.publishMode
      }
    );
  }

  function updatePublishDraft(
    entryId: string,
    patch: Partial<{
      slug: string;
      title: string;
      description: string;
      publishMode: string;
    }>
  ) {
    setPublishDrafts((current) => {
      const previous = current[entryId] ?? {
        slug: "",
        title: "",
        description: "",
        publishMode: "notes_only"
      };

      return {
        ...current,
        [entryId]: {
          ...previous,
          ...patch
        }
      };
    });
  }

  async function handleCreateEntry() {
    setError("");
    setStatus("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          content,
          contentFormat: "markdown",
          excerpt: excerpt || undefined,
          logicalPath: logicalPath || undefined,
          aliases: aliases
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          tags: tags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          visibility: "private"
        })
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: EntryCard;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "Unable to create entry.");
      }

      setEntries((current) => [payload.data as EntryCard, ...current]);
      setStatus("Entry saved. The Markdown source and extracted wiki links were stored.");
      setTitle("");
      setExcerpt("");
      setAliases("");
      setTags("");
      setContent(initialMarkdown);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to create entry."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePublish(entry: EntryCard) {
    const draft = getPublishDraft(entry);
    setError("");
    setStatus("");
    setPublishingEntryId(entry.id);

    try {
      const response = await fetch("/api/blog/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entryId: entry.id,
          slug: draft.slug,
          title: draft.title || undefined,
          description: draft.description || undefined,
          publishMode: draft.publishMode
        })
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          status: string;
          publishedAt: string | null;
        };
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "Unable to publish entry.");
      }

      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                visibility: "public",
                publishMode: draft.publishMode,
                blogPost: {
                  id: payload.data!.id,
                  slug: payload.data!.slug,
                  title: payload.data!.title,
                  description: payload.data!.description,
                  status: payload.data!.status,
                  publishedAt: payload.data!.publishedAt
                }
              }
            : item
        )
      );
      setStatus("Entry published to the public blog.");
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Unable to publish entry."
      );
    } finally {
      setPublishingEntryId(null);
    }
  }

  async function handleUnpublish(entry: EntryCard) {
    setError("");
    setStatus("");
    setPublishingEntryId(entry.id);

    try {
      const response = await fetch("/api/blog/unpublish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entryId: entry.id
        })
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "Unable to unpublish entry.");
      }

      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id && item.blogPost
            ? {
                ...item,
                blogPost: {
                  ...item.blogPost,
                  status: "unpublished",
                  publishedAt: null
                }
              }
            : item
        )
      );
      setStatus("Entry unpublished from the public blog.");
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Unable to unpublish entry."
      );
    } finally {
      setPublishingEntryId(null);
    }
  }

  return (
    <div className="editor-layout">
      <section className="panel editor-panel">
        <p className="panel-kicker">Creation Screen</p>
        <h2 className="panel-title">Write directly in Markdown</h2>
        <p className="muted-copy">
          This writes a text entry through the existing backend API, stores the raw
          Markdown, derives plain text, extracts any wiki links, and infers the
          entry type from the logical path.
        </p>

        <div className="editor-grid" style={{ marginTop: 20 }}>
          <label className="label">
            Title
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Why deep work still matters"
            />
          </label>

          <label className="label">
            Logical path
            <input
              className="input"
              value={logicalPath}
              onChange={(event) => setLogicalPath(event.target.value)}
              placeholder="ideas/attention, books/deep-work, people/karpathy"
            />
          </label>

          <label className="label">
            Aliases
            <input
              className="input"
              value={aliases}
              onChange={(event) => setAliases(event.target.value)}
              placeholder="deep work notes, focus memo"
            />
          </label>

          <div className="empty-state" style={{ gridColumn: "1 / -1", padding: 16 }}>
            `entryType` is inferred from the first segment of `logicalPath`.
            Examples: `ideas/...` -&gt; `idea`, `books/...` -&gt; `book_note`,
            `projects/...` -&gt; `project_note`, `people/...` -&gt; `person_note`.
          </div>

          <label className="label full">
            Excerpt
            <input
              className="input"
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              placeholder="Short summary for quick scanning"
            />
          </label>

          <label className="label full">
            Tags
            <input
              className="input"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="reading, writing, focus"
            />
          </label>

          <label className="label full">
            Markdown editor
            <textarea
              className="textarea editor-textarea"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
        </div>

        <div className="button-row" style={{ marginTop: 18 }}>
          <button
            className="button"
            type="button"
            onClick={handleCreateEntry}
            disabled={isSubmitting || !title.trim() || !content.trim()}
          >
            {isSubmitting ? "Saving..." : "Save entry"}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() => setContent(initialMarkdown)}
            disabled={isSubmitting}
          >
            Reset sample
          </button>
        </div>

        <div className={`status ${error ? "error" : status ? "success" : ""}`} style={{ marginTop: 12 }}>
          {error || status}
        </div>
      </section>

      <aside className="write-shell" style={{ gap: 20 }}>
        <section className="panel sidebar-panel">
          <p className="panel-kicker">Live Preview</p>
          <h2 className="panel-title">What this entry looks like</h2>
          <div
            className="preview"
            style={{ marginTop: 18 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(content) }}
          />
        </section>

        <section className="panel sidebar-panel">
          <p className="panel-kicker">Recent Entries</p>
          <h2 className="panel-title">Stored through the API</h2>
          <div className="entry-list" style={{ marginTop: 18 }}>
            {entries.length === 0 ? (
              <div className="empty-state">
                No entries yet. Save your first Markdown note to see it here.
              </div>
            ) : (
              entries.map((entry) => (
                <article className="entry-card" key={entry.id}>
                  <h3>{entry.title}</h3>
                  <div className="meta-row">
                    <span>{entry.entryType}</span>
                    {entry.logicalPath ? <span>{entry.logicalPath}</span> : null}
                    <span>{entry.visibility}</span>
                    <span>{new Date(entry.updatedAt).toLocaleString()}</span>
                  </div>
                  {entry.excerpt ? <p className="muted-copy">{entry.excerpt}</p> : null}
                  {entry.tags.length > 0 ? (
                    <div className="chip-row">
                      {entry.tags.map((tag) => (
                        <span className="chip" key={`${entry.id}-${tag}`}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {entry.wikiLinks.length > 0 ? (
                    <div className="meta-row" style={{ marginTop: 10 }}>
                      <span>
                        Links:{" "}
                        {entry.wikiLinks.map((link) => link.linkText || link.targetTitle).join(", ")}
                      </span>
                    </div>
                  ) : null}
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: "1px solid rgba(78, 47, 21, 0.12)"
                    }}
                  >
                    <div className="editor-grid">
                      <label className="label">
                        Blog slug
                        <input
                          className="input"
                          value={getPublishDraft(entry).slug}
                          onChange={(event) =>
                            updatePublishDraft(entry.id, { slug: event.target.value })
                          }
                          placeholder="my-entry"
                        />
                      </label>
                      <label className="label">
                        Publish mode
                        <select
                          className="select"
                          value={getPublishDraft(entry).publishMode}
                          onChange={(event) =>
                            updatePublishDraft(entry.id, {
                              publishMode: event.target.value
                            })
                          }
                        >
                          <option value="notes_only">Notes only</option>
                          <option value="summary_only">Summary only</option>
                          <option value="summary_and_notes">Summary and notes</option>
                        </select>
                      </label>
                      <label className="label full">
                        Public title
                        <input
                          className="input"
                          value={getPublishDraft(entry).title}
                          onChange={(event) =>
                            updatePublishDraft(entry.id, { title: event.target.value })
                          }
                          placeholder="Public blog title"
                        />
                      </label>
                      <label className="label full">
                        Public description
                        <input
                          className="input"
                          value={getPublishDraft(entry).description}
                          onChange={(event) =>
                            updatePublishDraft(entry.id, {
                              description: event.target.value
                            })
                          }
                          placeholder="Short blog description"
                        />
                      </label>
                    </div>
                    <div className="button-row" style={{ marginTop: 12 }}>
                      <button
                        className="button"
                        type="button"
                        onClick={() => handlePublish(entry)}
                        disabled={publishingEntryId === entry.id}
                      >
                        {publishingEntryId === entry.id ? "Publishing..." : "Publish to blog"}
                      </button>
                      {entry.blogPost?.status === "published" ? (
                        <>
                          <a
                            className="button-secondary"
                            href={`/blog/${entry.blogPost.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View public post
                          </a>
                          <button
                            className="button-danger"
                            type="button"
                            onClick={() => handleUnpublish(entry)}
                            disabled={publishingEntryId === entry.id}
                          >
                            Unpublish
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
