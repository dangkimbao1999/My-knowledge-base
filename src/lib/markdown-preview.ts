function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderInline(text: string) {
  return escapeHtml(text)
    .replace(/\[\[([^[\]\|]+?)(?:\|([^[\]]+))?\]\]/g, (_, target: string, alias?: string) => {
      return `<span class="wiki-link">${escapeHtml((alias || target).trim())}</span>`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="wiki-link">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function renderMarkdownPreview(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }

      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const content = line.replace(/^#{1,6}\s*/, "");
      html.push(`<h${level}>${renderInline(content)}</h${level}>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      html.push(`<blockquote>${renderInline(line.replace(/^\s*>\s?/, ""))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      html.push(`<p>&bull; ${renderInline(line.replace(/^\s*[-*+]\s+/, ""))}</p>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      html.push(`<p>${renderInline(line.replace(/^\s*\d+\.\s+/, ""))}</p>`);
      continue;
    }

    html.push(`<p>${renderInline(line)}</p>`);
  }

  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return html.join("");
}
