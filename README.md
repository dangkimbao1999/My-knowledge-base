# Second Brain Journal

Backend-first scaffold for an AI-powered personal journaling and knowledge system.

## Stack

- Next.js route handlers
- TypeScript
- Prisma
- PostgreSQL

## Current state

- Prisma schema added
- Prisma 7 config/client layout aligned to the current docs
- Backend module/service boundaries added
- API route placeholders added
- Env-backed single-user auth implemented
- Entry CRUD now persists through Prisma/PostgreSQL
- Text entries are Markdown-first with derived plain-text and wiki-link extraction
- Text `entryType` is inferred from `logicalPath` instead of being chosen in the UI
- Minimal UI added: `/auth` and `/write`
- MVP "Query your wiki" added on `/write`
- Blog publishing API and public UI added: `/blog` and `/blog/[slug]`
- Docker and docker-compose added for local runtime
- UI is intentionally minimal and focused on auth plus entry creation

## Next steps

1. Copy `.env.example` to `.env`
2. Set `APP_USERNAME` and `APP_PASSWORD`
3. Install dependencies
4. Run Prisma generate and migrations
5. Set AI env vars if you want to use "Query your wiki":
   - `OPENAI_API_KEY`
   - `OPENAI_API_BASE`
   - `OPENAI_API_BASE_DOCKER`
   - `LLM_MODEL`
   - `OPENAI_TEMPERATURE`
6. Add PDF extraction and broader AI processing

## Screens

- `/auth`: sign in with `APP_USERNAME` and `APP_PASSWORD`
- `/write`: Markdown editor + live preview + recent saved entries + query-your-wiki panel
- `/blog`: public published posts
- `/blog/[slug]`: public post detail

## Docker

Before running Docker, copy `.env.example` to `.env` and adjust the values if needed.

Run the project with Docker:

```bash
docker compose up --build
```

Default credentials come from `.env`:

- username: `admin`
- password: the value of `APP_PASSWORD`

The app will be available at [http://localhost:3000](http://localhost:3000).

The compose app container runs `prisma db push` on startup so the local database schema is applied automatically for this MVP.
