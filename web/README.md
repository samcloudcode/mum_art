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
