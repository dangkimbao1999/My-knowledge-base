import { z } from "zod";
import {
  CONTENT_FORMATS,
  ENTRY_PUBLISH_MODES,
  ENTRY_TYPES,
  ENTRY_VISIBILITIES,
  NOTE_TYPES
} from "@/shared/enums";

const authoredContentFormats = [
  CONTENT_FORMATS[0],
  CONTENT_FORMATS[1]
] as const;

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  displayName: z.string().min(2).max(80)
});

export const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8)
});

export const createTextEntrySchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  contentFormat: z.enum(authoredContentFormats).default("markdown"),
  excerpt: z.string().max(400).optional(),
  logicalPath: z.string().max(200).optional(),
  aliases: z.array(z.string().min(1).max(100)).default([]),
  tags: z.array(z.string().min(1).max(50)).default([]),
  visibility: z.enum(ENTRY_VISIBILITIES).default("private")
});

export const createBookEntrySchema = z.object({
  title: z.string().min(1).max(200),
  fileId: z.string().uuid(),
  author: z.string().max(200).optional(),
  excerpt: z.string().max(400).optional(),
  logicalPath: z.string().max(200).optional(),
  aliases: z.array(z.string().min(1).max(100)).default([]),
  tags: z.array(z.string().min(1).max(50)).default([]),
  visibility: z.enum(ENTRY_VISIBILITIES).default("private")
});

export const updateEntrySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  contentFormat: z.enum(authoredContentFormats).optional(),
  excerpt: z.string().max(400).nullable().optional(),
  logicalPath: z.string().max(200).nullable().optional(),
  aliases: z.array(z.string().min(1).max(100)).optional(),
  visibility: z.enum(ENTRY_VISIBILITIES).optional(),
  publishMode: z.enum(ENTRY_PUBLISH_MODES).optional(),
  archivedAt: z.string().datetime().nullable().optional()
});

export const updateVisibilitySchema = z.object({
  visibility: z.enum(ENTRY_VISIBILITIES)
});

export const updateTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(50))
});

export const updatePublishModeSchema = z.object({
  publishMode: z.enum(ENTRY_PUBLISH_MODES)
});

export const noteSchema = z.object({
  noteType: z.enum(NOTE_TYPES),
  title: z.string().max(200).optional(),
  content: z.string().min(1),
  chapterLabel: z.string().max(100).optional()
});

export const uploadPdfSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().int().positive(),
  checksumSha256: z.string().min(32)
});

export const attachPdfSchema = z.object({
  entryId: z.string().uuid(),
  fileId: z.string().uuid()
});

export const processEntrySchema = z.object({
  force: z.boolean().default(false),
  includeRelations: z.boolean().default(true)
});

export const searchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  visibility: z.enum(ENTRY_VISIBILITIES).optional(),
  types: z.array(z.enum(ENTRY_TYPES)).optional()
});

export const publishEntrySchema = z.object({
  entryId: z.string().uuid(),
  slug: z.string().min(1).max(200),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(320).optional(),
  publishMode: z.enum(ENTRY_PUBLISH_MODES).optional()
});

export const queryWikiSchema = z.object({
  query: z.string().min(1).max(400),
  limit: z.number().int().min(1).max(10).default(6).optional()
});
