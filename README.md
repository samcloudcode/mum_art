# Art Print Inventory System

Production inventory management for fine-art print editions as they move between
the artist and galleries. It tracks printing, framing, location, sales,
commission, settlement, and stock checks.

**Frontend:** Next.js + Supabase Auth (in `web/` directory)
**Backend:** Supabase (PostgreSQL)
**Hosting:** Vercel

## Production safety

> **There is no staging database.** Credentials are not committed, but whenever
> local or orb credentials target Supabase, the app and scripts read and write
> live inventory. Do not edit records, commit SQL, import data, migrate, or
> deploy without explicitly intending a production action. See
> [AGENTS.md](AGENTS.md) for the operational rules.

## Project Structure

```
mum_art/
├── web/                      # Next.js frontend (deployed to Vercel)
├── db/                       # Database layer
│   ├── models.py            # SQLAlchemy models with constraints
│   └── manager.py           # Connection pooling & operations
├── cleaning/                 # Data transformation
│   └── cleaner.py           # Smart name standardization & validation
├── sync/                     # Import engine
│   └── importer_smart.py    # Optimized bulk import with ON CONFLICT
├── scripts/db/               # One-off SQL fixes + dry-run runner (see its README)
├── airtable_export/         # Source CSV files
└── smart_import.py          # Import script
```

## Quick Start

### 1. Install dependencies

```bash
# Python 3.13 dependencies
uv sync --frozen

# Next.js dependencies
npm --prefix web ci
```

Fresh Amp orbs run `.agents/setup` automatically. It installs both locked
dependency sets and reuses them from the project snapshot.

### 2. Configure the environment

Database scripts use `DATABASE_URL` from the environment or an untracked `.env`.
The frontend needs `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in its environment or an untracked
`web/.env.local`. Do not put credentials in committed files.

An exported `DATABASE_URL` takes precedence over `.env`, so a script can be
pointed at an isolated test database without editing files.

### 3. Run the frontend

```bash
npm --prefix web run dev
```

With production Supabase credentials configured, localhost writes live data.

## Database scripts and imports

For ad-hoc SQL, use the runner. It rolls back unless `--commit` is passed:

```bash
uv run python scripts/db/run_sql.py path/to/query.sql
```

See [scripts/db/README.md](scripts/db/README.md) for conventions on one-off
scripts, the dry-run guarantees, and the testing fixture.

The full CSV import clears and repopulates core tables and requires an explicit
confirmation phrase:

```bash
echo "IMPORT" | uv run python smart_import.py
```

The generated import report is displayed in the app from
`web/docs/user/import_assumptions.md`.

## Checks

```bash
npm --prefix web run lint
npm --prefix web run build
web/node_modules/.bin/tsc --noEmit --project web/tsconfig.json
```

Build and type-check currently pass; lint has known existing failures that are
tracked for cleanup.

## Deployment

```bash
vercel --prod --cwd web
```

Vercel does **not** auto-deploy from GitHub for this project. Pushing or merging
`master` does not change the live application; production changes only after an
explicit Vercel deployment. The Amp release workflow will be documented here
once it is configured.

## Migrations

The repository contains historical migrations, but no tooling records which
ones production has applied. The application expects current fields including
`editions.edition_type` and `editions.status_confidence`; inspect the live schema
instead of relying on an old status note.

Never run every migration in a loop. There are three historical `003` files,
some migrations are data-specific, and not all are safe to replay. See
[the migration history](supabase/migrations/README.md) before handling a schema
change.

## Data Model

| Table | Description |
|-------|-------------|
| `prints` | Master catalog of print designs. Standardized names (e.g. "No Man's Fort" not "NoMansFort"), unique on name. |
| `distributors` | Galleries and sales channels. Commission rates 0–50%. |
| `editions` | Individual print editions. Each belongs to one print and optional distributor. Tracks sales, pricing and location. |
| `sync_logs` | Audit trail of sync operations. |
| `activity_log` | Audit trail of user changes; one row per changed field. |

Row counts drift with every import — query the database rather than quoting a
number. `editions.size` is NULL for roughly half of rows, which is correct: old
imports guessed 'Small' for anything unmeasured and those guesses have since
been cleared. A blank size means nobody has measured that edition.

## Import Design

- **Bulk inserts** via psycopg2's `execute_values`, 5,000 records per batch.
- **ON CONFLICT handling** resolves duplicates at the database level.
- **Connection pooling** maintains 10 persistent connections (overflow 20).
- **Duplicate decisions** are pre-computed in `duplicate_handling_decisions.csv`;
  listed `record_id`s are skipped at import. If the file is absent the importer
  falls back to resolving duplicates dynamically.
- **Smart cleaning** standardizes names, currencies, dates and relationships
  before load.

A full import runs in well under a minute.

## Documentation

- `AGENTS.md` — canonical project and production-safety guidance
- `web/README.md` — frontend-specific setup
- `web/docs/user/` — guides rendered inside the application
- `supabase/migrations/README.md` — migration history and safety
- `planning/` and `PRPs/` — historical design proposals, not current-state
  guarantees

## License

Private - Internal Use Only
