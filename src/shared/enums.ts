export const ENTRY_TYPES = [
  "journal",
  "note",
  "book",
  "reflection",
  "book_note",
  "idea",
  "project_note",
  "person_note"
] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_VISIBILITIES = ["private", "public"] as const;
export type EntryVisibility = (typeof ENTRY_VISIBILITIES)[number];

export const ENTRY_PUBLISH_MODES = [
  "none",
  "summary_only",
  "notes_only",
  "summary_and_notes"
] as const;
export type EntryPublishMode = (typeof ENTRY_PUBLISH_MODES)[number];

export const CONTENT_FORMATS = [
  "markdown",
  "plain_text",
  "extracted_pdf_text"
] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const NOTE_TYPES = [
  "general",
  "chapter_reflection",
  "overall_reflection",
  "lesson_learned",
  "personal_note"
] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const PROCESSING_STATES = [
  "pending",
  "queued",
  "running",
  "completed",
  "failed"
] as const;
export type ProcessingState = (typeof PROCESSING_STATES)[number];

export const PROCESSING_JOB_TYPES = [
  "extract_pdf_text",
  "process_entry",
  "generate_summary",
  "extract_topics",
  "extract_knowledge",
  "link_relations",
  "reindex_search"
] as const;
export type ProcessingJobType = (typeof PROCESSING_JOB_TYPES)[number];
