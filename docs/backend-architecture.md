# Second Brain Journal Backend Plan

## Section 1: Backend architecture

### Stack choice

Use `Next.js + TypeScript + Prisma + PostgreSQL` for the MVP.

- `Next.js` route handlers ship fast and let you keep backend and future frontend in one repo.
- `Prisma` is fast for schema iteration and keeps the data model readable.
- `PostgreSQL` handles relational data, JSON metadata, full-text search, and later vector extensions cleanly.
- A modular service layer under `src/modules/*` keeps domain boundaries explicit so you can move hot paths to workers later.

### Major modules and boundaries

- `auth`: registration, login, session issuance, current user.
- `entries`: the core aggregate root. Owns entry CRUD, settings, and ownership checks.
- `files`: upload registration, file metadata, PDF storage references, extraction state.
- `notes`: personal reflections and notes, always separate from raw source and AI artifacts.
- `processing`: orchestrates PDF extraction, summarization, topic extraction, knowledge extraction, relation linking, and reindexing.
- `ai`: model adapter boundary. Keeps prompts/providers out of route handlers.
- `search`: unified querying over entry source, notes, and AI artifacts.
- `knowledge`: aggregated read APIs over `AIKnowledgeItem` and topics.
- `blog`: public projection layer. Never becomes the source object.
- `jobs`: processing lifecycle, retries, telemetry, and operator visibility.

Markdown-first note model:

- user-authored text entries should be stored as raw Markdown
- the backend should derive plain text for search/AI processing
- wiki-style links such as `[[Deep Work]]` should be extracted into structured link records

### Request flow

1. Client calls route handler in `app/api/...`.
2. Route validates input with `zod`.
3. Auth is resolved from session/JWT.
4. Route calls a module service.
5. Service loads domain records through Prisma, enforces ownership/visibility, and writes state.
6. If processing is needed, service creates or updates a `ProcessingJob`.
7. Response returns the updated resource or accepted job status.

### File upload flow

For MVP:

1. Client calls `POST /api/files/upload` with file metadata.
2. Backend creates an `EntryFileSource` row and returns upload metadata.
3. Client uploads file to local disk or object storage using the returned storage key.
4. Client creates a book entry with `entryType=book` or attaches the file to an existing entry.
5. User manually triggers processing, or backend auto-creates a pending extraction job.

Synchronous in MVP:

- Metadata validation.
- DB row creation.

Asynchronous:

- Actual binary transfer finalization if you move to presigned uploads.
- PDF text extraction.
- AI generation.

### AI processing flow

1. `POST /api/ai/entries/:entryId/process` is called.
2. Backend verifies ownership and entry readiness.
3. For book entries, ensure extracted text exists or queue `extract_pdf_text`.
4. Create `ProcessingJob(type=process_entry)`.
5. Worker or inline executor reads canonical source layers only.
6. Pipeline creates new AI artifact versions: summary, topics, knowledge items, relations.
7. Search document is refreshed.
8. Entry `processingState` and `lastProcessedAt` are updated.

MVP recommendation:

- Manual trigger for processing.
- Inline execution for text entries.
- Background-style deferred execution for book entries, even if still implemented in the app server first.

Later:

- Move every processing stage into a real queue worker.

### Blog publish flow

1. User sets entry visibility to `public`.
2. User chooses `publishMode`.
3. User calls publish endpoint.
4. Blog service composes public content from allowed layers only:
   - AI summary
   - personal notes/reflections
   - or both
5. A `BlogPost` row is upserted with materialized `publishedContent`.
6. Public endpoints read `BlogPost` only, never raw source tables directly.

### Search flow

1. Search service builds a unified search query over a denormalized `Entry.searchDocument` plus joined notes and AI artifact projections.
2. Results preserve `resultType` such as `entry`, `note`, `summary`, `knowledge`.
3. Every result returns originating `entryId`.
4. Access rules filter private data before ranking.

### Job processing flow

MVP:

- Create a `ProcessingJob` record for every heavy task.
- Run short jobs inline after record creation when acceptable.
- Keep status visible through polling endpoint.

Later:

- Dedicated worker process consumes jobs.
- Queue can be Postgres-backed first, then Redis/BullMQ when throughput matters.

### Sync vs async recommendations

Synchronous:

- Auth.
- Entry CRUD.
- Note CRUD.
- Tag updates.
- Visibility updates.
- Publish/unpublish after inputs already exist.

Asynchronous:

- PDF extraction.
- Summary generation.
- Topic extraction.
- Knowledge extraction.
- Relation linking.
- Search reindex if it becomes expensive.

Manual-triggered in MVP:

- Initial AI processing.
- Reprocessing after prompt/model changes.
- Publishing for public projection.

Queue later:

- Any job exceeding a few seconds.
- Book ingestion.
- Related-entry graph generation across large corpora.

## Section 2: Domain model

### Core entities

- `User`: account owner for every private artifact in the system.
- `Entry`: primary aggregate root. Represents journal text, knowledge notes, books, or reflections.
- `EntryTextSource`: canonical raw text source. Stores written text or extracted PDF text, versioned separately from AI output.
- `EntryLink`: explicit user-authored wiki links between entries. This is distinct from AI-inferred relations.
- `EntryFileSource`: stored file metadata for PDFs and future files. Keeps binary source concerns separate from text content.
- `EntryNote`: personal notes and reflections. This is the user-authored interpretive layer, never mixed with raw source or AI artifacts.
- `AISummary`: AI-generated summary version for an entry.
- `AITopic`: extracted topical labels with traceability metadata.
- `AIKnowledgeItem`: normalized AI-derived insights/facts/concepts that reference source chunks.
- `EntryRelation`: graph edge between entries for “related”, “references”, or similar relationships.
- `Tag`: user-owned tag vocabulary.
- `EntryTag`: join table for tagging.
- `BlogPost`: public projection of an entry, with publish-safe materialized content.
- `ProcessingJob`: persistent record of heavy backend work and operational state.

### Why these separations matter

Text entry vs book entry:

- Both are `Entry`.
- Text entries usually have one `EntryTextSource(raw_text)`.
- Book entries usually have one `EntryFileSource(pdf)` plus one `EntryTextSource(extracted_pdf_text)`.

Original source vs AI-derived vs personal notes:

- Original source lives in `EntryTextSource` and `EntryFileSource`.
- AI-derived content lives in `AISummary`, `AITopic`, `AIKnowledgeItem`, and `EntryRelation`.
- Personal reflections live in `EntryNote`.

Source entry vs blog projection:

- `Entry` is the private internal source object.
- `BlogPost` is a publish-safe read model built from selected layers.
- For books, the PDF remains private by default even if the blog post is public.

## Section 3: Database schema

The Prisma schema in [schema.prisma](C:/Users/dangk/Documents/New project/prisma/schema.prisma) is optimized for MVP speed while preserving future growth.

### Notes on normalization

- Source content, notes, and AI artifacts are separated into dedicated tables.
- `Entry` carries high-level lifecycle and search fields for fast reads.
- JSON metadata fields are used where the payload is not stable enough yet to deserve more tables.

### Indexes

Recommended initial indexes already included:

- `Entry(ownerId, createdAt desc)`
- `Entry(ownerId, entryType, visibility)`
- `Entry(visibility, publishedAt)`
- `EntryTextSource(entryId, sourceKind, version desc)`
- `EntryFileSource(ownerId, createdAt desc)`
- `EntryNote(entryId, noteType, createdAt desc)`
- `AISummary(entryId, version desc)`
- `AITopic(slug)`
- `AIKnowledgeItem(entryId, version desc)`
- `EntryRelation(sourceEntryId)` and `(targetEntryId)`
- `BlogPost(status, publishedAt desc)`
- `ProcessingJob(state, createdAt desc)` and `(jobType, state)`

### Search fields for MVP

- `Entry.searchDocument`: denormalized text blob for PostgreSQL full-text.
- `Entry.searchVector`: reserved for generated `tsvector`.
- `Entry.processingState`, `lastProcessedAt`, `lastProcessingError`: surface operational state at the aggregate level.

### Fields for later embeddings

Add later:

- `Entry.embedding vector`
- `EntryNote.embedding vector`
- `AISummary.embedding vector`
- `AIKnowledgeItem.embedding vector`
- `chunk_embeddings` table if you introduce chunk-level retrieval

### Tables likely needing versioning later

- `EntryNote` if you want note edit history.
- `BlogPost` if you want published revision history.
- `AIKnowledgeItem` if extracted knowledge becomes auditable per processing run.
- `EntryRelation` if relation history or decay matters.

## Section 4: API design

The scaffolded endpoints live under `app/api/*`.

### Auth

`POST /api/auth/register`

- Purpose: register user.
- Request:
```json
{
  "email": "user@example.com",
  "password": "strong-password",
  "displayName": "Alice"
}
```
- Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "displayName": "Alice"
    }
  }
}
```
- Access: public.

`POST /api/auth/login`

- Purpose: authenticate and issue session.
- Request: email/password.
- Response: token/session + current user.
- Access: public.

`POST /api/auth/logout`

- Purpose: clear session.
- Access: authenticated.

`GET /api/auth/me`

- Purpose: return current user.
- Access: authenticated.

### Entries

`POST /api/entries`

- Purpose: create text or book entry.
- Text request:
```json
{
  "title": "Daily reflection",
  "entryType": "journal",
  "content": "Raw journal text",
  "tags": ["health"],
  "visibility": "private"
}
```
- Book request:
```json
{
  "title": "Deep Work",
  "entryType": "book",
  "fileId": "uuid",
  "author": "Cal Newport",
  "tags": ["productivity"],
  "visibility": "private"
}
```
- Response: created entry.
- Access: authenticated owner only.

`GET /api/entries`

- Purpose: list owned entries with filters.
- Query: `q`, `type`, `visibility`, pagination later.
- Access: authenticated.

`GET /api/entries/:entryId`

- Purpose: get entry detail including source/notes/AI/blog status.
- Access: owner only.

`PATCH /api/entries/:entryId`

- Purpose: update title/excerpt/archival metadata and limited mutable settings.
- Access: owner only.

`DELETE /api/entries/:entryId`

- Purpose: soft delete later or hard delete in MVP.
- Access: owner only.

### Entry settings

`PATCH /api/entries/:entryId/settings/visibility`

- Request:
```json
{ "visibility": "public" }
```
- Access: owner only.

`PUT /api/entries/:entryId/settings/tags`

- Request:
```json
{ "tags": ["reading", "ideas"] }
```
- Access: owner only.

`PATCH /api/entries/:entryId/settings/publish-mode`

- Request:
```json
{ "publishMode": "summary_and_notes" }
```
- Access: owner only.

`POST /api/entries/:entryId/ai/reprocess`

- Purpose: manual reprocess trigger.
- Response: accepted job descriptor.
- Access: owner only.

### Notes

`POST /api/entries/:entryId/notes`

- Request:
```json
{
  "noteType": "chapter_reflection",
  "title": "Chapter 3",
  "chapterLabel": "Chapter 3",
  "content": "My reflection"
}
```
- Access: owner only.

`PATCH /api/entries/:entryId/notes/:noteId`

- Purpose: update note.
- Access: owner only.

`DELETE /api/entries/:entryId/notes/:noteId`

- Purpose: delete note.
- Access: owner only.

`GET /api/entries/:entryId/notes`

- Purpose: list notes for entry.
- Access: owner only.

### Upload / file handling

`POST /api/files/upload`

- Purpose: register PDF upload.
- Request:
```json
{
  "fileName": "book.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 123456,
  "checksumSha256": "..."
}
```
- Response: file record + storage key.
- Access: authenticated.

`POST /api/files/attach`

- Purpose: attach uploaded PDF to entry.
- Request:
```json
{
  "entryId": "uuid",
  "fileId": "uuid"
}
```
- Access: owner only.

`GET /api/files/:fileId`

- Purpose: get file metadata and extraction state.
- Access: owner only.

### AI processing

`POST /api/ai/entries/:entryId/process`

- Purpose: start processing.
- Request:
```json
{
  "force": false,
  "includeRelations": true
}
```
- Response: accepted job status.
- Access: owner only.

`POST /api/entries/:entryId/ai/reprocess`

- Purpose: rerun with latest prompt/model config.
- Access: owner only.

`GET /api/ai/entries/:entryId/status`

- Purpose: fetch processing status.
- Access: owner only.

### Search

`GET /api/search?q=...`

- Purpose: unified search across entries, notes, summaries, and knowledge.
- Response: typed result list containing `entryId`, `resultType`, `title`, `snippet`, `score`.
- Access: authenticated; public variant can be added later for blog only.

### Knowledge

`GET /api/knowledge`

- Purpose: list aggregated knowledge across owned entries.
- Access: authenticated.

`GET /api/knowledge/topics/:topicSlug`

- Purpose: list knowledge constrained to a topic.
- Access: authenticated.

### Blog

`POST /api/blog/publish`

- Purpose: materialize a public blog projection.
- Request:
```json
{
  "entryId": "uuid",
  "slug": "deep-work-summary",
  "title": "Deep Work Summary",
  "description": "Notes and insights"
}
```
- Access: owner only and only when entry visibility is `public`.

`POST /api/blog/unpublish`

- Purpose: remove public projection.
- Request: `{ "entryId": "uuid" }`
- Access: owner only.

`GET /api/blog/posts`

- Purpose: list public blog posts.
- Access: public.

`GET /api/blog/posts/:slug`

- Purpose: get public blog detail.
- Access: public.
- Must never expose raw PDF URLs or private notes.

## Section 5: AI processing pipeline

### MVP pipeline design

Service functions:

- `processEntry(entryId)`
- `extractPdfText(fileId)`
- `generateSummary(entryId)`
- `extractKnowledge(entryId)`
- `linkRelatedEntries(entryId)`

### Text entries

1. Load latest `EntryTextSource(raw_text)`.
2. Chunk if content exceeds model comfort window.
3. Generate summary.
4. Extract topics.
5. Extract knowledge items with source references.
6. Link to related entries using existing summaries/topics/knowledge.
7. Save new AI artifact versions.

### Book entries

1. Ensure `EntryFileSource(pdf)` exists.
2. Run `extractPdfText(fileId)` and store output in `EntryTextSource(extracted_pdf_text)`.
3. Chunk extracted text by token budget, ideally aligned to page/chapter boundaries when possible.
4. Summarize per chunk, then summarize summaries into entry-level summary.
5. Extract concepts/knowledge per chunk.
6. Merge/deduplicate knowledge items.
7. Generate relations to other entries.
8. Keep user notes separate; notes can inform public presentation later, but should not overwrite canonical source text.

### Chunking strategy

For MVP:

- Chunk by approximate tokens using characters or words.
- Include chunk metadata: chunk index, page range when available, and source offsets.
- Use overlapping chunks only when extraction quality is weak.

For long PDFs:

- First pass: chunk-level extraction.
- Second pass: reducer pass over chunk summaries and chunk knowledge.
- Never feed the entire PDF into one request.

### Traceability

Preserve:

- `sourceSnapshotHash` on every AI artifact.
- `sourceChunkId` or `sourceReferences` JSON.
- Page or section references where extraction supports them.

That allows:

- explainability
- reprocessing
- publish-safe citations back to source fragments

### Reprocessing when prompts/models change

- Store `modelName` and `promptVersion` on every AI artifact.
- Bump a processing config version when prompts change.
- `reprocess` creates new artifact versions and marks old ones `superseded`.
- Keep source content immutable or append-only by version.

### Avoiding long-term context issues

- Do not rely on the model remembering old entry history.
- Always reconstruct context from DB at processing time.
- Store durable intermediate outputs: chunk summaries, extraction metadata, knowledge items.
- Compute final public projections from stored artifacts, not from ad hoc prompts.

### What to store vs compute on demand

Store:

- extracted text
- summaries
- topics
- knowledge items
- relations
- processing metadata
- source references

Compute on demand later:

- conversational synthesis across many entries
- custom retrieval bundles
- transient answer formatting

## Section 6: Search and retrieval design

### MVP search

Use PostgreSQL full-text search first.

- Build a denormalized searchable text field from:
  - `Entry.title`
  - latest `EntryTextSource`
  - `EntryNote.content`
  - latest `AISummary.summaryMarkdown`
  - `AIKnowledgeItem.title/content`
- Maintain `Entry.searchDocument` for aggregate-level ranking.
- Use explicit joins when returning typed child results like notes or knowledge items.

### Search result preservation

Each result should return:

- `resultType`
- `entryId`
- `entryType`
- `sourceLayer` (`raw_source`, `note`, `ai_summary`, `knowledge`)
- `title`
- `snippet`
- `score`

### Ranking logic

Initial weighted ranking:

- Title hits highest weight.
- Tag/topic hits medium-high.
- Summary/knowledge medium.
- Raw source and notes medium.
- Recent entries get a small freshness bump for private search.

### Indexing strategy

MVP:

- GIN index on `to_tsvector('english', search_document)` via raw SQL migration later.
- Standard btree indexes already in schema for ownership and lifecycle filters.

Future semantic search:

- Add `pgvector`.
- Generate embeddings for entry summaries, notes, and chunked source text.
- Hybrid rank using:
  - lexical score
  - semantic similarity
  - ownership/visibility filter
  - result-type weights

### Combining raw content, notes, and AI-derived content

Use layered ranking, not flattening away provenance:

- Search all layers.
- Return best matching layer as the primary hit.
- Always include originating `entryId`.
- Allow UI to group multiple hits under one entry later.

### Next.js note

Using Next.js for both frontend and backend is fine here because:

- route handlers are enough for an MVP API
- you can add React pages later without moving the backend
- you avoid separate deployment pipelines early

## Section 7: Background jobs and processing model

### Processing states

- `pending`
- `queued`
- `running`
- `completed`
- `failed`

### Job lifecycle

1. Create `ProcessingJob`.
2. Mark `queuedAt`.
3. Executor marks `running` and `startedAt`.
4. Executor writes `result` or `errorMessage`.
5. Mark terminal state and `completedAt`.
6. Update aggregate `Entry.processingState`.

### Failure handling

- Record failure reason on both job and entry.
- Retry transient AI/provider/storage failures.
- Do not retry validation or ownership errors.

### Retries

MVP:

- `maxAttempts = 3`
- exponential backoff implemented in executor logic or cron sweep

### Observability and logging

- structured logs with request id, user id, entry id, job id
- metrics later for:
  - job duration
  - success/failure rate
  - extraction latency
  - AI token usage

### MVP execution model

Inline in MVP:

- text-entry processing if short
- search document refresh
- publish composition

Move to queue first:

- PDF extraction
- long summaries
- relation linking across many entries
- bulk reprocessing

### Scalable version later

- API creates job rows only.
- Worker service polls or consumes queue.
- Split job types into independent processors.
- Add dead-letter handling for poison jobs.

## Section 8: Security and ownership model

### Authentication

- Email/password for MVP.
- Session cookie or JWT-backed cookie.
- Hash passwords with bcrypt/argon2.

### Authorization

- Every private row is scoped by `ownerId`.
- Route handlers must verify ownership before returning or mutating entries, files, notes, or jobs.
- Public blog endpoints must read `BlogPost` only.

### User ownership rules

- `Entry.ownerId` is the root ownership field.
- `EntryFileSource.ownerId` ensures unattached uploads are still owned.
- `EntryNote.ownerId` prevents cross-account note access.
- `ProcessingJob.ownerId` keeps operator/job views scoped.

### Public vs private access

- Default everything private.
- Entry visibility decides whether publishing is allowed.
- Publishing creates a projection; it does not expose internal layers automatically.

### Protecting raw PDFs

- Never expose raw storage keys publicly.
- Use signed URLs for owners only if direct file access is required.
- Blog endpoints should omit file metadata beyond safe descriptive fields.

### Public blog allowlist

Allowed:

- blog title
- slug
- description
- published content
- safe metadata like publish date and entry title

Not allowed:

- raw PDF
- extracted full raw text by default
- private notes
- processing metadata
- internal job state

### Basic validation and safety

- zod validation on every route.
- file upload validation: MIME type, extension, size, checksum.
- rate limit auth, search, and processing trigger endpoints.
- virus scan uploads later when moving beyond local storage.
- strip executable content and reject non-PDF masquerades.

## Section 9: Execution plan

### Chosen implementation strategy

Start with a monorepo-like single Next.js app that is backend-first.

What is already scaffolded:

- Next.js app shell with frontend placeholder in [page.tsx](C:/Users/dangk/Documents/New project/app/page.tsx)
- API route structure under [app/api](C:/Users/dangk/Documents/New project/app/api)
- modular backend service folders under [src/modules](C:/Users/dangk/Documents/New project/src/modules)
- env/config helpers under [src/config](C:/Users/dangk/Documents/New project/src/config)
- Prisma/PostgreSQL schema in [schema.prisma](C:/Users/dangk/Documents/New project/prisma/schema.prisma)

### Immediate implementation order

1. Install dependencies and generate Prisma client.
2. Add the first migration plus a raw SQL GIN index for search.
3. Implement real auth and session cookie issuance.
4. Implement `entriesService`, `notesService`, and `filesService` against Prisma.
5. Add local file storage adapter and PDF extraction adapter.
6. Implement manual `processEntry` pipeline with versioned AI artifacts.
7. Build unified search query and blog projection composition.

### Backend starter components included

- Route placeholders for all requested API surfaces.
- service stubs for auth, entries, files, notes, processing, search, knowledge, and blog.
- shared enums and request schemas.

### Frontend placeholder only

The frontend is intentionally a placeholder page only. No feature UI was implemented, which keeps the repo focused on backend architecture and starter backend surfaces.
