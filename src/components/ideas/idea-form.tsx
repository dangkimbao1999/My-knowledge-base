"use client";

import { useRef, useState, type FormEvent } from "react";

// ponytail: execCommand is deprecated but still supported by every browser; swap for Tiptap/Lexical if formatting needs grow.
const TOOLS = [
  { command: "bold", label: "B", title: "Bold" },
  { command: "italic", label: "I", title: "Italic" },
  { command: "underline", label: "U", title: "Underline" },
  { command: "formatBlock", value: "h3", label: "H", title: "Heading" },
  { command: "insertUnorderedList", label: "•", title: "Bulleted list" },
  { command: "insertOrderedList", label: "1.", title: "Numbered list" },
  { command: "formatBlock", value: "blockquote", label: "❝", title: "Quote" }
];

export function IdeaForm() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  function run(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  function addLink() {
    const url = window.prompt("Link URL");
    if (url) run("createLink", url);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const editor = editorRef.current;

    if (!editor?.innerText.trim()) {
      setError("Hãy mô tả ý tưởng của bạn.");
      editor?.focus();
      return;
    }

    const data = new FormData(form);
    setState("sending");
    setError(null);

    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          name: data.get("name"),
          email: data.get("email"),
          contact: data.get("contact") || undefined,
          website: data.get("website") || undefined,
          descriptionHtml: editor.innerHTML
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Gửi không thành công.");
      }

      form.reset();
      editor.innerHTML = "";
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gửi không thành công.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="idea-form idea-form-done">
        <h3>Cảm ơn bạn! 🎉</h3>
        <p>Ý tưởng đã được gửi. Mình sẽ đọc và liên hệ lại nếu ý tưởng được chọn.</p>
        <button type="button" className="idea-submit" onClick={() => setState("idle")}>
          Gửi thêm ý tưởng
        </button>
      </div>
    );
  }

  return (
    <form className="idea-form" onSubmit={handleSubmit}>
      <label className="idea-field">
        <span>Tên ý tưởng *</span>
        <input name="title" required minLength={3} maxLength={200} placeholder="VD: App nhắc uống nước bằng AI" />
      </label>

      <div className="idea-field">
        <span id="idea-desc-label">Mô tả sản phẩm *</span>
        <div className="idea-editor">
          <div className="idea-toolbar" role="toolbar" aria-label="Formatting">
            {TOOLS.map((tool) => (
              <button
                key={tool.title}
                type="button"
                title={tool.title}
                aria-label={tool.title}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(tool.command, tool.value)}
              >
                {tool.label}
              </button>
            ))}
            <button type="button" title="Link" aria-label="Link" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
              🔗
            </button>
          </div>
          <div
            ref={editorRef}
            className="idea-editor-body"
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-labelledby="idea-desc-label"
            data-placeholder="Vấn đề bạn gặp, ai sẽ dùng, sản phẩm hoạt động thế nào, tính năng chính..."
            suppressContentEditableWarning
          />
        </div>
      </div>

      <div className="idea-row">
        <label className="idea-field">
          <span>Tên của bạn *</span>
          <input name="name" required maxLength={120} />
        </label>
        <label className="idea-field">
          <span>Email *</span>
          <input name="email" type="email" required maxLength={200} />
        </label>
      </div>

      <label className="idea-field">
        <span>Liên hệ khác (SĐT, Facebook, LinkedIn...)</span>
        <input name="contact" maxLength={300} />
      </label>

      <input name="website" className="idea-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      {error ? <p className="idea-error" role="alert">{error}</p> : null}

      <button type="submit" className="idea-submit" disabled={state === "sending"}>
        {state === "sending" ? "Đang gửi..." : "Gửi ý tưởng →"}
      </button>
    </form>
  );
}
