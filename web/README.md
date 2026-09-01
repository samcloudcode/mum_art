# Mum Art web application

Next.js frontend for the live art-print inventory system. Supabase provides
authentication, database access, and artwork storage.

## Setup

```bash
npm ci
```

The app uses these untracked environment values. `OPENAI_API_KEY` is optional
unless voice transcription is enabled:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY
```

Configure them in Vercel for production. For local development they may be
supplied through the shell or an untracked `.env.local`. `ANTHROPIC_MODEL` and
`ASSISTANT_TIME_ZONE` optionally override the assistant defaults. The Anthropic
key is server-only and must never use a `NEXT_PUBLIC_` prefix. `OPENAI_API_KEY`
is also server-only and is required only for voice transcription.

> There is no staging database. If local values point at the production
> Supabase project, every edit in the local app writes live inventory.

The current inventory assistant requires the individually reviewed migration
sequence `010_add_inventory_assistant.sql`,
`011_add_assistant_sales_and_undo.sql`, and
`012_add_assistant_physical_details.sql`. Its confirmation function applies an
exact proposal and its activity log together in one transaction. Do not deploy
schema-dependent assistant code before coordinating each required migration
with the production release.

## Assistant runtime

`POST /api/assistant/messages` returns ordinary JSON for authentication,
validation and configuration failures before model work begins. It then streams
newline-delimited JSON containing bounded progress categories and one terminal
success or error event. Progress is transient UI state: only the user's request
and final assistant answer are stored as conversation messages. Inventory still
changes only through the separate proposal-confirmation endpoint.

Every Anthropic agent step uses ephemeral prompt caching. Successful and failed
runs write privacy-safe structured timing events for model duration, tool
duration, token use and cache hits; they never log message text, record IDs,
catalogue values, images, proposals, user IDs or conversation IDs.

## Commands

```bash
npm run dev       # development server
npm run build     # production build and Next.js type checking
npm run typecheck # standalone TypeScript check
npm run lint      # ESLint, with zero warnings allowed
npm test          # deterministic assistant, stream, and proposal tests
npm run check     # lint, type-check, and production build in sequence
npm run start     # serve an existing production build
```

User guides shown at `/guide` are loaded from `docs/user` relative to this
directory. `web/docs/user` is therefore their canonical repository location.

## Deployment

Vercel uses this directory as the project's Root Directory and automatically
deploys pushes to the production branch, `master`. Read the root `README.md`,
`AGENTS.md`, and `.agents/ship.md` before any production action. Amp Ship runs
the release checks, pushes the reviewed commit, and verifies Vercel's GitHub
deployment status without storing Vercel credentials.
