"use client";

import { useEffect, useMemo, useState } from "react";
import { renderMarkdownPreview } from "@/lib/markdown-preview";

type EntryCard = {
  id: string;
  title: string;
  entryType: string;
  excerpt: string | null;
  logicalPath: string | null;
  aliases: string[];
  tags: string[];
  content: string | null;
  contentFormat: string | null;
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
    pinnedAt: string | null;
    pinSlot: number | null;
    publishedAt: string | null;
  } | null;
  updatedAt: string;
};

type NavigationNode = {
  id: string;
  name: string;
  path: string | null;
  children: NavigationNode[];
  entries: Array<{
    id: string;
    title: string;
    logicalPath: string | null;
    entryType: string;
    visibility: string;
    updatedAt: string;
  }>;
};

type EntryEditorProps = {
  initialEntries: EntryCard[];
  initialNavigation: NavigationNode;
};

type DraftState = {
  title: string;
  excerpt: string;
  logicalPath: string;
  aliases: string;
  tags: string;
  content: string;
};

type PublishDraftState = {
  slug: string;
  title: string;
  description: string;
  publishMode: string;
  pinSlot: string;
};

const initialMarkdown = `# Untitled note

Write in Markdown here.

- Capture one idea at a time
- Link related entries like [[Deep Work]]
`;

function createEmptyDraft(path = "inbox"): DraftState {
  return {
    title: "",
    excerpt: "",
    logicalPath: path,
    aliases: "",
    tags: "",
    content: initialMarkdown
  };
}

function toDraft(entry: EntryCard): DraftState {
  return {
    title: entry.title,
    excerpt: entry.excerpt ?? "",
    logicalPath: entry.logicalPath ?? "inbox",
    aliases: entry.aliases.join(", "),
    tags: entry.tags.join(", "),
    content: entry.content ?? initialMarkdown
  };
}

function collectPaths(node: NavigationNode, paths = new Set<string>()) {
  if (node.path) {
    paths.add(node.path);
  }

  for (const child of node.children) {
    collectPaths(child, paths);
  }

  return paths;
}

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toPublishDraft(entry: EntryCard | null): PublishDraftState {
  if (!entry) {
    return {
      slug: "",
      title: "",
      description: "",
      publishMode: "notes_only",
      pinSlot: ""
    };
  }

  return {
    slug: entry.blogPost?.slug ?? createSlug(entry.title),
    title: entry.blogPost?.title ?? entry.title,
    description: entry.blogPost?.description ?? entry.excerpt ?? "",
    publishMode: entry.publishMode === "none" ? "notes_only" : entry.publishMode,
    pinSlot: entry.blogPost?.pinSlot ? String(entry.blogPost.pinSlot) : ""
  };
}

export function EntryEditor({ initialEntries, initialNavigation }: EntryEditorProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [navigation, setNavigation] = useState(initialNavigation);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(initialEntries[0]?.id ?? null);
  const [draft, setDraft] = useState<DraftState>(
    initialEntries[0] ? toDraft(initialEntries[0]) : createEmptyDraft()
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    collectPaths(initialNavigation)
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [publishDraft, setPublishDraft] = useState<PublishDraftState>(
    toPublishDraft(initialEntries[0] ?? null)
  );

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );

  useEffect(() => {
    setPublishDraft(toPublishDraft(selectedEntry));
  }, [selectedEntry]);

  async function refreshNavigation() {
    const response = await fetch("/api/entries/navigation");
    const payload = (await response.json()) as {
      success: boolean;
      data?: {
        root: NavigationNode;
      };
      error?: { message?: string };
    };

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error?.message || "Unable to refresh navigation.");
    }

    const root = payload.data.root;

    setNavigation(root);
    setExpandedPaths((current) => {
      const next = new Set(current);

      for (const path of collectPaths(root)) {
        next.add(path);
      }

      return next;
    });
  }

  function updateDraft<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updatePublishDraft<K extends keyof PublishDraftState>(
    key: K,
    value: PublishDraftState[K]
  ) {
    setPublishDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function saveExistingEntry(entryId: string) {
    const tags = draft.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const aliases = draft.aliases
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const updateResponse = await fetch(`/api/entries/${entryId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: draft.title,
        excerpt: draft.excerpt || null,
        logicalPath: draft.logicalPath || null,
        aliases,
        content: draft.content,
        contentFormat: "markdown"
      })
    });

    const updatePayload = (await updateResponse.json()) as {
      success: boolean;
      data?: EntryCard;
      error?: { message?: string };
    };

    if (!updateResponse.ok || !updatePayload.success || !updatePayload.data) {
      throw new Error(updatePayload.error?.message || "Unable to update entry.");
    }

    const tagResponse = await fetch(`/api/entries/${entryId}/settings/tags`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tags
      })
    });

    const tagPayload = (await tagResponse.json()) as {
      success: boolean;
      data?: EntryCard;
      error?: { message?: string };
    };

    if (!tagResponse.ok || !tagPayload.success || !tagPayload.data) {
      throw new Error(tagPayload.error?.message || "Unable to update tags.");
    }

    const savedEntry = tagPayload.data as EntryCard;

    setEntries((current) =>
      current.map((entry) => (entry.id === entryId ? savedEntry : entry))
    );
    setDraft(toDraft(savedEntry));
    await refreshNavigation();

    return savedEntry;
  }

  function handleSelectEntry(entryId: string) {
    const entry = entries.find((item) => item.id === entryId);

    if (!entry) {
      return;
    }

    setSelectedEntryId(entry.id);
    setDraft(toDraft(entry));
    setError("");
    setStatus("");
  }

  function handleNewEntry(path?: string | null) {
    setSelectedEntryId(null);
    setDraft(createEmptyDraft(path ?? selectedEntry?.logicalPath ?? "inbox"));
    setError("");
    setStatus("Ready for a new entry.");
  }

  function toggleFolder(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  }

  async function handleSave() {
    setIsSaving(true);
    setError("");
    setStatus("");

    try {
      if (selectedEntryId) {
        await saveExistingEntry(selectedEntryId);
        setStatus("Entry updated.");
      } else {
        const tags = draft.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const aliases = draft.aliases
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const createResponse = await fetch("/api/entries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: draft.title,
            content: draft.content,
            contentFormat: "markdown",
            excerpt: draft.excerpt || undefined,
            logicalPath: draft.logicalPath || undefined,
            aliases,
            tags,
            visibility: "private"
          })
        });

        const createPayload = (await createResponse.json()) as {
          success: boolean;
          data?: EntryCard;
          error?: { message?: string };
        };

        if (!createResponse.ok || !createPayload.success || !createPayload.data) {
          throw new Error(createPayload.error?.message || "Unable to create entry.");
        }

        const createdEntry = createPayload.data as EntryCard;
        setEntries((current) => [createdEntry, ...current]);
        setSelectedEntryId(createdEntry.id);
        setDraft(toDraft(createdEntry));
        setStatus("Entry created.");
        await refreshNavigation();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save entry.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedEntryId) {
      return;
    }

    setIsDeleting(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch(`/api/entries/${selectedEntryId}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "Unable to delete entry.");
      }

      const remainingEntries = entries.filter((entry) => entry.id !== selectedEntryId);
      setEntries(remainingEntries);

      if (remainingEntries[0]) {
        setSelectedEntryId(remainingEntries[0].id);
        setDraft(toDraft(remainingEntries[0]));
      } else {
        setSelectedEntryId(null);
        setDraft(createEmptyDraft());
      }

      await refreshNavigation();
      setStatus("Entry deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete entry.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handlePublish() {
    if (!selectedEntry) {
      return;
    }

    setIsPublishing(true);
    setError("");
    setStatus("");

    try {
      const savedEntry = await saveExistingEntry(selectedEntry.id);

      const response = await fetch("/api/blog/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entryId: savedEntry.id,
          slug: publishDraft.slug,
          title: publishDraft.title || undefined,
          description: publishDraft.description || undefined,
          publishMode: publishDraft.publishMode
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
          pinnedAt: string | null;
          pinSlot: number | null;
          publishedAt: string | null;
        };
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "Unable to publish entry.");
      }

      setEntries((current) =>
        current.map((entry) =>
          entry.id === savedEntry.id
            ? {
                ...entry,
                visibility: "public",
                publishMode: publishDraft.publishMode,
                blogPost: {
                  id: payload.data!.id,
                  slug: payload.data!.slug,
                  title: payload.data!.title,
                  description: payload.data!.description,
                  status: payload.data!.status,
                  pinnedAt: payload.data!.pinnedAt,
                  pinSlot: payload.data!.pinSlot,
                  publishedAt: payload.data!.publishedAt
                }
              }
            : entry
        )
      );
      setStatus("Entry published to blog.");
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to publish entry.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!selectedEntry) {
      return;
    }

    setIsPublishing(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch("/api/blog/unpublish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entryId: selectedEntry.id
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
        current.map((entry) =>
          entry.id === selectedEntry.id && entry.blogPost
            ? {
                ...entry,
                blogPost: {
                  ...entry.blogPost,
                  status: "unpublished",
                  pinnedAt: null,
                  pinSlot: null,
                  publishedAt: null
                }
              }
            : entry
        )
      );
      setStatus("Entry unpublished from blog.");
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to unpublish entry.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleDeletePost() {
    if (!selectedEntry || !selectedEntry.blogPost) {
      return;
    }

    setIsPublishing(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch("/api/blog/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entryId: selectedEntry.id
        })
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "Unable to delete blog post.");
      }

      setEntries((current) =>
        current.map((entry) =>
          entry.id === selectedEntry.id
            ? {
                ...entry,
                visibility: "private",
                publishMode: "none",
                blogPost: null
              }
            : entry
        )
      );
      setStatus("Blog post deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete blog post.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handlePin() {
    if (!selectedEntry || selectedEntry.blogPost?.status !== "published") {
      return;
    }

    const slot = Number.parseInt(publishDraft.pinSlot, 10);

    if (!Number.isInteger(slot) || slot < 1 || slot > 12) {
      setError("Pin slot must be a number from 1 to 12.");
      setStatus("");
      return;
    }

    setIsPinning(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch("/api/blog/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entryId: selectedEntry.id,
          pinSlot: slot
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
          pinnedAt: string | null;
          pinSlot: number | null;
          publishedAt: string | null;
        };
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "Unable to pin blog post.");
      }

      setEntries((current) =>
        current.map((entry) =>
          entry.id === selectedEntry.id && entry.blogPost
            ? {
                ...entry,
                blogPost: {
                  ...entry.blogPost,
                  pinnedAt: payload.data!.pinnedAt,
                  pinSlot: payload.data!.pinSlot
                }
              }
            : entry
        )
      );
      setPublishDraft((current) => ({
        ...current,
        pinSlot: String(slot)
      }));
      setStatus(`Blog post pinned to slot ${slot}.`);
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Unable to pin blog post.");
    } finally {
      setIsPinning(false);
    }
  }

  async function handleUnpin() {
    if (!selectedEntry || !selectedEntry.blogPost) {
      return;
    }

    setIsPinning(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch("/api/blog/unpin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entryId: selectedEntry.id
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
          pinnedAt: string | null;
          pinSlot: number | null;
          publishedAt: string | null;
        };
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "Unable to unpin blog post.");
      }

      setEntries((current) =>
        current.map((entry) =>
          entry.id === selectedEntry.id && entry.blogPost
            ? {
                ...entry,
                blogPost: {
                  ...entry.blogPost,
                  pinnedAt: payload.data!.pinnedAt,
                  pinSlot: payload.data!.pinSlot
                }
              }
            : entry
        )
      );
      setPublishDraft((current) => ({
        ...current,
        pinSlot: ""
      }));
      setStatus("Blog post removed from pinned section.");
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Unable to unpin blog post.");
    } finally {
      setIsPinning(false);
    }
  }

  function renderNode(node: NavigationNode, depth = 0) {
    const isExpanded = !node.path || expandedPaths.has(node.path);

    return (
      <div className="cms-tree-node" key={node.id}>
        {node.path ? (
          <button
            className="cms-tree-folder"
            style={{ paddingLeft: 14 + depth * 14 }}
            type="button"
            onClick={() => toggleFolder(node.path!)}
          >
            <span>{isExpanded ? "v" : ">"}</span>
            <span>{node.name}</span>
          </button>
        ) : null}

        {isExpanded ? (
          <div className="cms-tree-children">
            {node.children.map((child) => renderNode(child, depth + 1))}
            {node.entries.map((entry) => (
              <button
                className={`cms-tree-entry ${selectedEntryId === entry.id ? "active" : ""}`}
                key={entry.id}
                style={{ paddingLeft: (node.path ? depth + 1 : depth) * 14 + 28 }}
                type="button"
                onClick={() => handleSelectEntry(entry.id)}
              >
                <span className="cms-tree-entry-title">{entry.title}</span>
                <span className="cms-tree-entry-meta">{entry.entryType}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="cms-layout">
      <aside className="panel cms-sidebar">
        <div className="cms-sidebar-header">
          <div>
            <p className="panel-kicker">Navigation</p>
            <h2 className="panel-title">By logical path</h2>
          </div>
        </div>

        <div className="cms-sidebar-tree">
          {navigation.children.length === 0 && navigation.entries.length === 0 ? (
            <div className="empty-state">No entries yet. Create your first page on the right.</div>
          ) : (
            <>
              {navigation.children.map((node) => renderNode(node))}
              {navigation.entries.map((entry) => (
                <button
                  className={`cms-tree-entry ${selectedEntryId === entry.id ? "active" : ""}`}
                  key={entry.id}
                  type="button"
                  onClick={() => handleSelectEntry(entry.id)}
                >
                  <span className="cms-tree-entry-title">{entry.title}</span>
                  <span className="cms-tree-entry-meta">{entry.entryType}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </aside>

      <section className="panel cms-editor">
        <div className="cms-editor-header">
          <div>
            <p className="panel-kicker">{selectedEntry ? "Selected Entry" : "New Entry"}</p>
            <h2 className="panel-title">
              {selectedEntry ? selectedEntry.title : "Untitled"}
            </h2>
            <p className="muted-copy">
              {selectedEntry
                ? `Last updated ${new Date(selectedEntry.updatedAt).toLocaleString()}`
                : "Create directly from the writing space, similar to a CMS page editor."}
            </p>
          </div>

          <div className="button-row">
            <button
              className="button"
              type="button"
              onClick={() => handleNewEntry(selectedEntry?.logicalPath)}
            >
              New entry
            </button>
            {selectedEntry ? (
              <button
                className="button-danger"
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="cms-properties">
          <label className="label">
            Title
            <input
              className="input cms-title-input"
              value={draft.title}
              onChange={(event) => updateDraft("title", event.target.value)}
              placeholder="A concise page title"
            />
          </label>

          <label className="label">
            Logical path
            <input
              className="input"
              value={draft.logicalPath}
              onChange={(event) => updateDraft("logicalPath", event.target.value)}
              placeholder="ideas/product/knowledge"
            />
          </label>

          <label className="label">
            Tags
            <input
              className="input"
              value={draft.tags}
              onChange={(event) => updateDraft("tags", event.target.value)}
              placeholder="ai, architecture, product"
            />
          </label>

          <label className="label">
            Aliases
            <input
              className="input"
              value={draft.aliases}
              onChange={(event) => updateDraft("aliases", event.target.value)}
              placeholder="alternative names, comma separated"
            />
          </label>

          <label className="label cms-property-wide">
            Excerpt
            <input
              className="input"
              value={draft.excerpt}
              onChange={(event) => updateDraft("excerpt", event.target.value)}
              placeholder="Short summary for previews and blog projection"
            />
          </label>
        </div>

        <div className="cms-editor-body">
          <textarea
            className="textarea editor-textarea cms-writing-area"
            value={draft.content}
            onChange={(event) => updateDraft("content", event.target.value)}
            placeholder="Write your entry in Markdown..."
          />

          <aside className="cms-preview-panel">
            <p className="panel-kicker">Preview</p>
            <div
              className="preview cms-preview"
              dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(draft.content) }}
            />

            <section className="cms-publish-panel">
              <p className="panel-kicker">Public Projection</p>
              {selectedEntry ? (
                <>
                  <label className="label">
                    Blog slug
                    <input
                      className="input"
                      value={publishDraft.slug}
                      onChange={(event) => updatePublishDraft("slug", event.target.value)}
                      placeholder="my-public-entry"
                    />
                  </label>

                  <label className="label">
                    Public title
                    <input
                      className="input"
                      value={publishDraft.title}
                      onChange={(event) => updatePublishDraft("title", event.target.value)}
                      placeholder="Public blog title"
                    />
                  </label>

                  <label className="label">
                    Public description
                    <input
                      className="input"
                      value={publishDraft.description}
                      onChange={(event) => updatePublishDraft("description", event.target.value)}
                      placeholder="Short blog description"
                    />
                  </label>

                  <label className="label">
                    Publish mode
                    <select
                      className="select"
                      value={publishDraft.publishMode}
                      onChange={(event) => updatePublishDraft("publishMode", event.target.value)}
                    >
                      <option value="notes_only">Notes only</option>
                      <option value="summary_only">Summary only</option>
                      <option value="summary_and_notes">Summary and notes</option>
                    </select>
                  </label>

                  <label className="label">
                    Pin slot
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={12}
                      value={publishDraft.pinSlot}
                      onChange={(event) => updatePublishDraft("pinSlot", event.target.value)}
                      placeholder="1 = biggest, 12 = lowest pinned priority"
                    />
                  </label>

                  <div className="cms-publish-meta">
                    <span>Status: {selectedEntry.blogPost?.status ?? "draft"}</span>
                    <span>Visibility: {selectedEntry.visibility}</span>
                    <span>Pinned: {selectedEntry.blogPost?.pinnedAt ? "yes" : "no"}</span>
                    <span>Slot: {selectedEntry.blogPost?.pinSlot ?? "-"}</span>
                  </div>

                  <div className="button-row">
                    <button
                      className="button"
                      type="button"
                      onClick={handlePublish}
                      disabled={isPublishing || isSaving || !publishDraft.slug.trim()}
                    >
                      {isPublishing ? "Publishing..." : "Publish to blog"}
                    </button>

                    {selectedEntry.blogPost ? (
                      <>
                        {selectedEntry.blogPost.status === "published" ? (
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={handlePin}
                            disabled={isPinning}
                          >
                            {isPinning
                              ? "Saving slot..."
                              : selectedEntry.blogPost.pinnedAt
                                ? "Update pin slot"
                                : "Pin on home"}
                          </button>
                        ) : null}
                        <a
                          className="button-secondary"
                          href={`/blog/${selectedEntry.blogPost.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View public post
                        </a>
                        <button
                          className="button-danger"
                          type="button"
                          onClick={
                            selectedEntry.blogPost.status === "published"
                              ? selectedEntry.blogPost.pinnedAt
                                ? handleUnpin
                                : handleUnpublish
                              : handleDeletePost
                          }
                          disabled={isPublishing || isPinning}
                        >
                          {selectedEntry.blogPost.status === "published"
                            ? selectedEntry.blogPost.pinnedAt
                              ? "Unpin"
                              : "Unpublish"
                            : "Delete post"}
                        </button>
                        {selectedEntry.blogPost.status === "published" ? (
                          <button
                            className="button-danger"
                            type="button"
                            onClick={selectedEntry.blogPost.pinnedAt ? handleUnpublish : handleDeletePost}
                            disabled={isPublishing || isPinning}
                          >
                            {selectedEntry.blogPost.pinnedAt ? "Unpublish" : "Delete post"}
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  Save the entry first, then publish it from this panel.
                </div>
              )}
            </section>
          </aside>
        </div>

        <div className="cms-footer">
          <div className={`status ${error ? "error" : status ? "success" : ""}`}>
            {error || status}
          </div>
          <div className="button-row">
            <button
              className="button"
              type="button"
              onClick={handleSave}
              disabled={isSaving || isPublishing || !draft.title.trim() || !draft.content.trim()}
            >
              {isSaving ? "Saving..." : selectedEntry ? "Save changes" : "Create entry"}
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={() =>
                selectedEntry ? setDraft(toDraft(selectedEntry)) : setDraft(createEmptyDraft(draft.logicalPath))
              }
              disabled={isSaving}
            >
              Reset
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
