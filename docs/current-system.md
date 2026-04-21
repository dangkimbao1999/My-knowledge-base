# Second Brain Journal: Current System State

This document describes the system as it exists now in the codebase, not the original plan.

## 1. Stack and runtime

- Framework: `Next.js` route handlers + React App Router
- Language: `TypeScript`
- Database: `PostgreSQL`
- ORM: `Prisma`
- Auth: single-user username/password from environment variables
- AI integration: OpenAI-compatible APIs via configurable `OPENAI_API_BASE`
- Local runtime: `Dockerfile` + `docker-compose.yml`

Main runtime entry points:

- CMS: `/write`
- Auth: `/auth`
- Public blog: `/blog`
- Public blog post detail: `/blog/[slug]`

## 2. Core product model

The product is still centered on `Entry`.

An `Entry` may represent:

- journal writing
- note
- reflection
- book note
- idea
- project note
- person note
- book entry for uploaded documents later

For text entries, `entryType` is inferred from `logicalPath`.

Examples:

- `journal/...` -> `journal`
- `books/...` -> `book_note`
- `ideas/...` -> `idea`
- `projects/...` -> `project_note`

## 3. Data layers

The backend now separates data into distinct layers.

### 3.1 Original source layer

Source-of-truth content is stored in:

- `Entry`
- `EntryTextSource`
- `EntryFileSource` for future file/PDF work

Text entries are Markdown-first:

- raw Markdown is stored
- plain text is derived for search and AI processing
- wiki-style links are extracted into `EntryLink`

### 3.2 User-authored interpretation layer

Personal notes/reflections are stored separately in:

- `EntryNote`

This layer is not mixed into raw source text.

### 3.3 AI-derived layer

AI-generated and AI-extracted artifacts live in:

- `AISummary`
- `AITopic`
- `AIKnowledgeItem`
- `KnowledgeClaim`
- `Entity`
- `ClaimEntity`
- `EntryRelation`

This is now a more structured layer than the original MVP.

### 3.4 Public projection layer

Public blog content is stored separately in:

- `BlogPost`

This means the public site reads from a projection, not directly from private entries.

## 4. Evidence-first knowledge architecture

The system has been moved toward an evidence-first architecture.

### 4.1 Authoritative source

The authoritative text is still the original source content.

The backend does not treat summaries as the ultimate truth source.

### 4.2 Source chunks

Each processed text entry is split into `SourceChunk` records.

A `SourceChunk` stores:

- source text slice
- chunk index
- offsets
- token estimate
- snapshot hash
- optional embedding metadata

This is now the main retrieval unit.

### 4.3 Structured knowledge

Processing now extracts multiple structured artifact types per chunk:

- `AIKnowledgeItem`: concise derived knowledge units
- `KnowledgeClaim`: more atomic statements/insights/reflections/plans/questions
- `Entity`: named concepts or things referenced by claims

Claims are linked to entities through `ClaimEntity`.

Claims and knowledge items both preserve traceability back to source chunks.

### 4.4 Query-time synthesis

Internal wiki answers and public blog answers are generated at query time from retrieved source chunks.

This means:

- source chunks are authoritative
- structured artifacts help retrieval and organization
- final prose answers are synthesized on demand

## 5. Auth and ownership

Auth is currently simple by design:

- username and password are hardcoded in env
- login sets a session cookie
- current-user API resolves the env-backed user

This is a single-user MVP mode, not full multi-user auth yet.

Ownership model:

- `Entry.ownerId`
- `EntryNote.ownerId`
- `ProcessingJob.ownerId`
- `Entity.ownerId`
- `KnowledgeClaim.ownerId`

## 6. Entry authoring and CMS

The CMS screen is implemented in a Notion-like layout.

### 6.1 Left navigation

The left sidebar is built from `logicalPath`.

It uses:

- `GET /api/entries/navigation`

This produces a tree-like navigation view from entry organization paths.

### 6.2 Right workspace

The right panel is the authoring space:

- create new entry
- edit existing entry
- write Markdown
- preview content
- publish to blog

### 6.3 Markdown support

For text entries:

- Markdown is the canonical authoring format
- plain text is derived automatically
- `[[Wiki Links]]` are parsed and stored as `EntryLink`

## 7. Blog system

The public blog is implemented and styled separately.

### 7.1 Publish model

Publishing creates or updates a `BlogPost`.

Current publish modes:

- `summary_only`
- `notes_only`
- `summary_and_notes`

Publishing updates:

- public visibility
- slug
- public title
- public description
- materialized `publishedContent`

### 7.2 Public UI

Public pages exist at:

- `/blog`
- `/blog/[slug]`

The blog uses a custom terminal/Linux-inspired theme.

### 7.3 Public chatbot

The blog home page has a public chatbot.

Important boundary:

- it only retrieves from `BlogPost` rows with `status = published`
- it does not read private entries
- it does not read private source chunks

Public retrieval is chunked from `publishedContent`, not from private raw entry content.

## 8. Processing pipeline

Processing currently exists for text entries.

Main service:

- `processingService.processEntry(...)`

Current flow:

1. load latest text source
2. normalize plain text
3. split into `SourceChunk`
4. generate summary
5. extract topics
6. extract knowledge items per chunk
7. extract claims per chunk
8. upsert entities from claims
9. generate chunk embeddings when configured
10. build related-entry links
11. refresh aggregate search document
12. persist job/result status

Artifacts are versioned through `latestAIVersion`.

Old active AI artifacts are marked `superseded` on reprocessing.

## 9. Search and retrieval

The internal retrieval layer is now hybrid-ready.

### 9.1 Internal wiki retrieval

Main retrieval unit:

- `SourceChunk`

Current ranking combines:

- lexical score from source chunk text
- lexical score from knowledge items
- lexical score from claims/entities
- lexical score from entry metadata
- semantic reranking from chunk embeddings when available

So the internal system now supports:

- lexical-only retrieval when embeddings are absent
- hybrid retrieval when embeddings exist

### 9.2 Public retrieval

Public blog retrieval uses:

- chunked `BlogPost.publishedContent`

This is query-time chunking over published material only.

### 9.3 Unified search API

`GET /api/search` now returns multiple views:

- `results`: chunk matches
- `entryResults`: aggregated entry-level matches
- `knowledgeResults`: AI knowledge items
- `claimResults`: structured claims
- `entityResults`: entity matches
- `topicResults`: topic matches

This gives the backend a much richer search contract than the original MVP.

## 10. Knowledge APIs

The knowledge APIs now expose more than topics and knowledge items.

### 10.1 `GET /api/knowledge`

Returns:

- topic overview
- evidence-backed knowledge items
- claims
- entities

### 10.2 `GET /api/knowledge/topics/:topicSlug`

Returns topic drill-down including:

- topic metadata
- related entries
- knowledge items for that topic
- claims for that topic
- entities associated with that topic
- related topics

This is the beginning of a real browsable knowledge graph layer.

## 11. AI provider capabilities

The AI provider currently supports:

- summary generation
- topic extraction
- knowledge extraction
- claim extraction
- embeddings

These run through configurable OpenAI-compatible endpoints.

Relevant env vars:

- `OPENAI_API_KEY`
- `OPENAI_API_BASE`
- `LLM_MODEL`
- `EMBEDDING_MODEL`
- `OPENAI_TEMPERATURE`

## 12. Background jobs and status

Heavy processing is tracked in `ProcessingJob`.

Current behavior:

- job row is created
- status moves through queued/running/completed/failed
- processing still runs inside the app server flow for MVP convenience

This is operationally visible even though it is not yet a separate worker architecture.

## 13. What is implemented vs deferred

### Implemented now

- env-backed auth
- Prisma persistence for entries
- Markdown-first authoring
- wiki link extraction
- notes persistence
- blog publish/unpublish
- public blog UI
- public blog chatbot
- processing jobs
- source chunking
- summary/topic/knowledge extraction
- claim/entity extraction
- chunk embeddings
- hybrid internal retrieval
- unified search
- topic drill-down

### Deferred or partial

- real multi-user auth
- upload/PDF extraction pipeline
- file storage hardening
- rate limiting and broader security hardening
- re-embed job
- contradiction detection between claims
- explicit claim-to-claim relationships
- dedicated worker queue
- pgvector-based database similarity search

## 14. Current architectural summary

The current system can be summarized as:

- database-first
- Markdown-first for writing
- evidence-first for AI processing
- structured knowledge built incrementally
- query-time synthesis for answers
- strict separation between private source data and public blog projection

This is no longer just a journaling backend with summaries.

It is now a personal knowledge system with:

- source preservation
- chunk-level retrieval
- structured AI artifacts
- claims and entities
- grounded answering
- public-safe projection
