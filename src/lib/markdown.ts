import type { ContentFormat } from "@/shared/enums";

export type WikiLink = {
  targetTitle: string;
  linkText: string | null;
};

const wikiLinkPattern = /\[\[([^[\]\|]+?)(?:\|([^[\]]+))?\]\]/g;

export function extractWikiLinks(content: string): WikiLink[] {
  const links: WikiLink[] = [];

  for (const match of content.matchAll(wikiLinkPattern)) {
    const targetTitle = match[1]?.trim();
    const linkText = match[2]?.trim() || null;

    if (!targetTitle) {
      continue;
    }

    links.push({
      targetTitle,
      linkText
    });
  }

  return links;
}

export function toPlainText(content: string, contentFormat: ContentFormat) {
  if (contentFormat !== "markdown") {
    return content.replace(/\r\n/g, "\n").trim();
  }

  return content
    .replace(/\r\n/g, "\n")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(wikiLinkPattern, (_, target: string, alias?: string) => alias?.trim() || target.trim())
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
