export function tokenize(value: string) {
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length > 1)
    )
  ];
}

export function countMatches(haystack: string, needles: string[]) {
  const normalizedHaystack = haystack.toLowerCase();
  let matches = 0;

  for (const needle of needles) {
    if (normalizedHaystack.includes(needle)) {
      matches += 1;
    }
  }

  return matches;
}

export function buildSnippet(text: string, tokens: string[]) {
  const compactText = text.replace(/\s+/g, " ").trim();

  if (!compactText) {
    return "";
  }

  const lowered = compactText.toLowerCase();
  const matchedIndex = tokens
    .map((token) => lowered.indexOf(token))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (matchedIndex === undefined) {
    return compactText.slice(0, 220);
  }

  const start = Math.max(0, matchedIndex - 80);
  const end = Math.min(compactText.length, matchedIndex + 180);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < compactText.length ? "..." : "";

  return `${prefix}${compactText.slice(start, end).trim()}${suffix}`;
}

export type SourceChunkDraft = {
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  content: string;
  tokenEstimate: number;
};

export function splitIntoSourceChunks(
  text: string,
  options?: {
    maxChars?: number;
    overlapChars?: number;
    minChars?: number;
  }
) {
  const normalizedText = text.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return [] as SourceChunkDraft[];
  }

  const maxChars = options?.maxChars ?? 1400;
  const overlapChars = options?.overlapChars ?? 180;
  const minChars = options?.minChars ?? 320;
  const chunks: SourceChunkDraft[] = [];

  let start = 0;
  let chunkIndex = 0;

  while (start < normalizedText.length) {
    const maxEnd = Math.min(normalizedText.length, start + maxChars);
    let end = maxEnd;

    if (maxEnd < normalizedText.length) {
      const slice = normalizedText.slice(start, maxEnd);
      const breakCandidates = [
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("; "),
        slice.lastIndexOf(", "),
        slice.lastIndexOf(" ")
      ].filter((index) => index >= minChars);

      if (breakCandidates.length > 0) {
        end = start + Math.max(...breakCandidates) + 1;
      }
    }

    const content = normalizedText.slice(start, end).trim();

    if (content) {
      chunks.push({
        chunkIndex,
        startOffset: start,
        endOffset: end,
        content,
        tokenEstimate: Math.ceil(content.length / 4)
      });
      chunkIndex += 1;
    }

    if (end >= normalizedText.length) {
      break;
    }

    start = Math.max(0, end - overlapChars);
  }

  return chunks;
}
