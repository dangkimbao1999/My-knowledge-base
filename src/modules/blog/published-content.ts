import { ApiError } from "@/lib/api";

type BuildPublishedContentInput = {
  entryType: string;
  title: string;
  excerpt?: string | null;
  summaryMarkdown?: string | null;
  notesMarkdown?: string | null;
  markdown?: string | null;
  publishMode: string;
};

export function buildPublishedContent(input: BuildPublishedContentInput) {
  const sections: string[] = [`# ${input.title}`];

  if (input.excerpt) {
    sections.push(input.excerpt);
  }

  if (input.entryType === "book") {
    if (!input.excerpt) {
      throw new ApiError(
        "Book entries require an excerpt or reflection before publishing.",
        400
      );
    }

    return sections.join("\n\n");
  }

  if (input.publishMode === "summary_only") {
    if (input.summaryMarkdown) {
      sections.push(input.summaryMarkdown);
      return sections.join("\n\n");
    }

    if (!input.excerpt) {
      throw new ApiError(
        "Summary-only publish mode requires an AI summary or excerpt.",
        400
      );
    }

    return sections.join("\n\n");
  }

  if (input.publishMode === "notes_only") {
    if (input.markdown) {
      sections.push(input.markdown);
      return sections.join("\n\n");
    }

    if (input.notesMarkdown) {
      sections.push(input.notesMarkdown);
      return sections.join("\n\n");
    }
  }

  if (input.publishMode === "summary_and_notes") {
    if (input.summaryMarkdown) {
      sections.push(input.summaryMarkdown);
    }

    if (input.markdown) {
      sections.push(input.markdown);
    } else if (input.notesMarkdown) {
      sections.push(input.notesMarkdown);
    }

    if (sections.length > 1) {
      return sections.join("\n\n");
    }
  }

  if (input.markdown) {
    sections.push(input.markdown);
  } else if (!input.excerpt) {
    throw new ApiError("This entry has no publishable text content yet.", 400);
  }

  return sections.join("\n\n");
}
