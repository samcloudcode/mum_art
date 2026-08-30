# Mum Art project guidance

## Purpose

This is the live inventory and sales system for an artist's fine-art print
editions. The Next.js application is in `web/`; Supabase PostgreSQL is the
backend. Prints are artwork designs, editions are individual physical copies,
and distributors are galleries or the artist's direct stock location.

## Production safety

- There is no staging database. When Supabase credentials are configured,
  local development and scripts operate on live inventory.
- Treat every stock check, edit, import, SQL commit, migration, and production
  deployment as a production action. Do not perform one unless the user
  explicitly requests that specific action.
- Prefer read-only checks and dry runs. `scripts/db/run_sql.py` rolls back by
  default; `--commit` writes to the database.
- Credentials are deliberately untracked. Do not assume `.env`,
  `web/.env.local`, or production credentials exist in a fresh checkout or orb.
- Never print secret values. Name missing variables without showing values.

## Data invariants

- Every edition belongs to one print. Its distributor is optional: NULL means
  there is no recorded location.
- All numbered edition records are created up front and become physical stock
  when `is_printed` is set.
- `edition_type` is `numbered` or `ap`. Artist's proofs do not count toward the
  numbered run or sell-through. AP 1 and numbered edition 1 may coexist.
- `status_confidence` is `verified`, `unverified`, or `legacy_unknown`.
  Dashboard statistics and the default edition list exclude `legacy_unknown`.
- A NULL edition size means it has not been measured; do not guess `Small`.
- Production row counts change over time. Query them rather than quoting
  historical documentation.

## Setup and checks

Fresh Amp orbs run `.agents/setup`, which installs Python 3.13, both locked
dependency sets, and the frontend toolchain. Manual application setup from the
repository root is:

```bash
uv sync --frozen
npm --prefix web ci
```

Run the complete frontend release check from the repository root:

```bash
npm --prefix web run check
```

This runs ESLint with zero warnings allowed, the standalone TypeScript check,
and the production build in sequence. Run an individual stage with
`npm --prefix web run lint`, `npm --prefix web run typecheck`, or
`npm --prefix web run build`.

## Database operations

Set `DATABASE_URL` via the environment or an untracked `.env`. An exported value
takes precedence over `.env`.

```bash
# Read-only or dry-run SQL
uv run python scripts/db/run_sql.py scripts/db/<script>.sql

# Explicit production write
uv run python scripts/db/run_sql.py scripts/db/<script>.sql --commit
```

Migration application is not tracked automatically. Never infer production
state from files in `supabase/migrations`, and never apply every file in a loop.
Read `supabase/migrations/README.md`, inspect the live schema, and dry-run an
individual migration before requesting approval to commit it.

The CSV importer clears and repopulates core tables. It is production-destructive
and also requires typing `IMPORT`:

```bash
echo "IMPORT" | uv run python smart_import.py
```

## Frontend and deployment

```bash
# Development; writes live data when production credentials are configured
npm --prefix web run dev

# Production build
npm --prefix web run build
```

The existing Vercel `mum_art` project is connected to
`samcloudcode/mum_art`, uses `web` as its Root Directory, and tracks `master`
as its production branch. Every push to `master` automatically starts a
production deployment. Treat pushing `master` as a production action and
coordinate schema-dependent code and migrations so the live application and
database remain compatible.

The Amp project uses Custom Ship with the tracked prompt in `.agents/ship.md`.
Ship runs the complete frontend check, pushes `master`, and waits for Vercel's
GitHub deployment status on that exact commit. It does not require a Vercel
token. Database changes are excluded and require separate explicit approval.
Amp stores a copy of the prompt, so after editing `.agents/ship.md`, update the
project setting again:

```bash
amp projects update user_01KZRR03QFY939RW9SJC57G10J/mum_art \
  --ship-behavior custom \
  --custom-ship-prompt-file .agents/ship.md
```

## Documentation ownership

- `README.md` is the human-facing project and operations overview.
- `AGENTS.md` is the canonical guidance for coding agents.
- `CLAUDE.md` is only a compatibility pointer to this file.
- `web/docs/user` is the single source for guides rendered inside the app.
- `docs/import_assumptions.md` is a historical import record and caveat log.
- `planning` and `PRPs` contain point-in-time proposals; their present-tense
  descriptions are not proof of current application or production state.

## Project layout

- `web/` — Next.js frontend
- `db/`, `sync/`, `cleaning/` — Python data model and CSV import path
- `scripts/db/` — reviewable one-off SQL and the dry-run runner
- `supabase/migrations/` — historical schema and data migrations
- `web/docs/user/` — user guides displayed by the application
- `issues/` — known gaps and completed issue records
