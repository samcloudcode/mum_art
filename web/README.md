# Mum Art web application

Next.js frontend for the live art-print inventory system. Supabase provides
authentication, database access, and artwork storage.

## Setup

```bash
npm ci
```

The app requires these untracked environment values:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Vercel supplies them to production. For local development they may be supplied
through the shell or an untracked `.env.local`.

> There is no staging database. If local values point at the production
> Supabase project, every edit in the local app writes live inventory.

## Commands

```bash
npm run dev       # development server
npm run build     # production build and Next.js type checking
npm run typecheck # standalone TypeScript check
npm run lint      # ESLint, with zero warnings allowed
npm run check     # lint, type-check, and production build in sequence
npm run deploy:production # deploy the existing project to Vercel production
npm run start     # serve an existing production build
```

User guides shown at `/guide` are loaded from `docs/user` relative to this
directory. `web/docs/user` is therefore their canonical repository location.

## Deployment

From the repository root:

```bash
npm --prefix web run deploy:production
```

GitHub pushes do not automatically deploy this project. Read the root
`README.md`, `AGENTS.md`, and `.agents/ship.md` before any production action.
Deployment requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` in
the environment; the token must be stored as a secret.
