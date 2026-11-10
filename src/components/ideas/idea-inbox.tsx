"use client";

import { useState } from "react";
import { IDEA_STATUSES, IDEA_STATUS_LABELS } from "@/shared/ideas";

type IdeaStatus = (typeof IDEA_STATUSES)[number];

export type InboxIdea = {
  id: string;
  title: string;
  descriptionHtml: string;
  name: string;
  email: string;
  contact: string | null;
  status: IdeaStatus;
  createdAt: string;
};

export function IdeaInbox({ initialIdeas }: { initialIdeas: InboxIdea[] }) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [filter, setFilter] = useState<IdeaStatus | "all">("all");

  async function setStatus(id: string, status: IdeaStatus) {
    setIdeas((current) => current.map((idea) => (idea.id === id ? { ...idea, status } : idea)));
    const response = await fetch(`/api/ideas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!response.ok) window.location.reload();
  }

  const visible = filter === "all" ? ideas : ideas.filter((idea) => idea.status === filter);

  return (
    <section className="panel idea-inbox">
      <div className="button-row">
        {(["all", ...IDEA_STATUSES] as const).map((status) => (
          <button
            key={status}
            type="button"
            className={filter === status ? "button" : "button-ghost"}
            onClick={() => setFilter(status)}
          >
            {status === "all" ? "Tất cả" : IDEA_STATUS_LABELS[status]} (
            {status === "all" ? ideas.length : ideas.filter((idea) => idea.status === status).length})
          </button>
        ))}
      </div>

      {visible.length === 0 ? <p className="muted-copy">Chưa có ý tưởng nào.</p> : null}

      {visible.map((idea) => (
        <details
          key={idea.id}
          className="idea-item"
          onToggle={(event) => {
            if (event.currentTarget.open && idea.status === "unread") setStatus(idea.id, "read");
          }}
        >
          <summary>
            <strong style={{ fontWeight: idea.status === "unread" ? 800 : 500 }}>{idea.title}</strong>
            <span className="muted-copy">
              {idea.name} · {new Date(idea.createdAt).toLocaleString("vi-VN")}
            </span>
            <select
              className="select"
              value={idea.status}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setStatus(idea.id, event.target.value as IdeaStatus)}
            >
              {IDEA_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {IDEA_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </summary>

          <p>
            <a href={`mailto:${idea.email}`}>{idea.email}</a>
            {idea.contact ? ` · ${idea.contact}` : null}
          </p>
          {/* Untrusted public HTML: empty sandbox blocks scripts, forms and same-origin access. */}
          <iframe className="idea-preview" sandbox="" srcDoc={idea.descriptionHtml} title={idea.title} />
        </details>
      ))}
    </section>
  );
}
