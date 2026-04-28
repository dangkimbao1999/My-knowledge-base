function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(input: string) {
  return escapeHtml(input).replaceAll('"', "&quot;");
}

type WikiLinkResolution = {
  href?: string | null;
  className?: string;
};

type RenderMarkdownPreviewOptions = {
  resolveWikiLink?: (targetTitle: string, alias?: string) => WikiLinkResolution | null | undefined;
};

function parseTableRow(line: string) {
  const trimmedLine = line.trim();

  if (!trimmedLine.includes("|")) {
    return null;
  }

  const normalizedLine = trimmedLine.replace(/^\|/, "").replace(/\|$/, "");
  const cells = normalizedLine.split("|").map((cell) => cell.trim());

  return cells.length >= 2 ? cells : null;
}

function isTableDelimiter(line: string) {
  const cells = parseTableRow(line);

  if (!cells) {
    return false;
  }

  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function findNextNonEmptyLineIndex(lines: string[], startIndex: number) {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index]?.trim()) {
      return index;
    }
  }

  return -1;
}

function renderInline(text: string, options?: RenderMarkdownPreviewOptions) {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, altText: string, src: string, title?: string) => {
      if (src.startsWith("pending-upload://")) {
        return `<span class="image-upload-placeholder">${altText || "Uploading image..."}</span>`;
      }

      const alt = escapeAttribute(altText);
      const imageTitle = title ? ` title="${escapeAttribute(title)}"` : "";
      return `<img alt="${alt}" class="markdown-image" loading="lazy" src="${escapeAttribute(src)}"${imageTitle} />`;
    })
    .replace(/\[\[([^[\]\|]+?)(?:\|([^[\]]+))?\]\]/g, (_, target: string, alias?: string) => {
      const label = escapeHtml((alias || target).trim());
      const resolution = options?.resolveWikiLink?.(target.trim(), alias?.trim());
      const className = ["wiki-link", resolution?.className].filter(Boolean).join(" ");

      if (resolution?.href) {
        return `<a class="${escapeAttribute(className)}" href="${escapeAttribute(resolution.href)}">${label}</a>`;
      }

      return `<span class="${escapeAttribute(className)}">${label}</span>`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="wiki-link">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function renderMarkdownPreview(markdown: string, options?: RenderMarkdownPreviewOptions) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeBlockLanguage = "";
  let inMathBlock = false;
  let mathLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmedLine = line.trim();

    if (trimmedLine === "$$") {
      if (inMathBlock) {
        html.push(`<div class="math-display">$$${escapeHtml(mathLines.join("\n"))}$$</div>`);
        mathLines = [];
        inMathBlock = false;
      } else {
        inMathBlock = true;
      }

      continue;
    }

    if (inMathBlock) {
      mathLines.push(line);
      continue;
    }

    if (/^\$\$[\s\S]*\$\$$/.test(trimmedLine) && trimmedLine.length > 4) {
      html.push(`<div class="math-display">${escapeHtml(trimmedLine)}</div>`);
      continue;
    }

    if (trimmedLine.startsWith("```")) {
      if (inCodeBlock) {
        if (codeBlockLanguage === "math") {
          html.push(`<div class="math-display">$$${escapeHtml(codeLines.join("\n"))}$$</div>`);
        } else {
          html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        }
        codeLines = [];
        codeBlockLanguage = "";
        inCodeBlock = false;
      } else {
        codeBlockLanguage = trimmedLine.slice(3).trim().toLowerCase();
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

    const headerCells = parseTableRow(line);
    const delimiterIndex = findNextNonEmptyLineIndex(lines, index + 1);

    if (headerCells && delimiterIndex !== -1 && isTableDelimiter(lines[delimiterIndex] ?? "")) {
      const bodyRows: string[] = [];
      let rowIndex = delimiterIndex + 1;

      while (rowIndex < lines.length) {
        const nextLine = lines[rowIndex] ?? "";
        const nextTrimmedLine = nextLine.trim();

        if (!nextTrimmedLine) {
          rowIndex += 1;
          continue;
        }

        const rowCells = parseTableRow(nextLine);

        if (!rowCells) {
          break;
        }

        bodyRows.push(
          `<tr>${rowCells.map((cell) => `<td>${renderInline(cell, options)}</td>`).join("")}</tr>`
        );
        rowIndex += 1;
      }

      html.push(
        `<table><thead><tr>${headerCells
          .map((cell) => `<th>${renderInline(cell, options)}</th>`)
          .join("")}</tr></thead><tbody>${bodyRows.join("")}</tbody></table>`
      );
      index = rowIndex - 1;
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const content = line.replace(/^#{1,6}\s*/, "");
      html.push(`<h${level}>${renderInline(content, options)}</h${level}>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      html.push(`<blockquote>${renderInline(line.replace(/^\s*>\s?/, ""), options)}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      html.push(`<p>&bull; ${renderInline(line.replace(/^\s*[-*+]\s+/, ""), options)}</p>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      html.push(`<p>${renderInline(line.replace(/^\s*\d+\.\s+/, ""), options)}</p>`);
      continue;
    }

    html.push(`<p>${renderInline(line, options)}</p>`);
  }

  if (inCodeBlock) {
    if (codeBlockLanguage === "math") {
      html.push(`<div class="math-display">$$${escapeHtml(codeLines.join("\n"))}$$</div>`);
    } else {
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    }
  }

  if (inMathBlock) {
    html.push(`<div class="math-display">$$${escapeHtml(mathLines.join("\n"))}$$</div>`);
  }

  return html.join("");
}
