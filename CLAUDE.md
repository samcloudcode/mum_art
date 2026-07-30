# CLAUDE.md

## Project Overview
Art print inventory management system for tracking fine art editions as they move between home and galleries. Tracks print locations, sales status, and commissions.

**Backend:** Supabase (PostgreSQL)
**Frontend:** Next.js + Supabase Auth (in `web/` directory)

## Business Context
- Artist creates original print designs (artwork)
- Each design has multiple numbered editions (e.g., 1/350, 2/350)
- All edition records are pre-created upfront, then marked as `is_printed` when physically produced
- Editions move between "Direct" (artist's home, 0% commission) and galleries (40-50% commission)
- System tracks: printing status, framing, location, sales, and payment settlement

## Database (Supabase)

### Connection
```bash
# Set in .env (see .env.example)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

Port 5432 is the direct connection and is what the working setup uses. Port 6543
on the same host is the transaction pooler; it also works, but keeps no session
state between statements. An exported `DATABASE_URL` beats `.env`, so a script
can be pointed at a test database without editing files.

### Tables
Row counts are order-of-magnitude only — they drift with every import. Query the
database for a real number rather than quoting these.

| Table | Rough size | Description |
|-------|-----------|-------------|
| prints | tens | Master catalog of artwork designs |
| distributors | tens | Galleries and locations |
| editions | ~8,600 | Individual physical prints |
| sync_logs | - | Import audit trail |
| profiles | - | User profiles (for auth) |
| activity_log | - | Audit trail of user changes; one row per changed field |

About half of `editions.size` is NULL, and that is correct: old imports guessed
'Small' for anything unmeasured, and `scripts/db/04_backfill_blank_sizes.py`
cleared the guesses. A blank size means nobody has measured that edition.

Two edition columns change what a row means, so filter on them deliberately:

- `edition_type` — 'numbered' or 'ap'. Proofs sit outside the numbered run and
  must not count toward edition totals or sell-through. Uniqueness is
  `(print_id, edition_type, edition_number)`, so AP 1 and numbered 1 coexist.
  Proofs used to be negative numbers; they are not any more.
- `status_confidence` — 'verified', 'unverified' or 'legacy_unknown'. The
  dashboard and the default edition list exclude `legacy_unknown`, so a row
  marked that way is deliberately invisible rather than missing.

### Key Relationships
- One Print -> Many Editions
- One Distributor -> Many Editions
- Each Edition belongs to exactly ONE Print and ONE Distributor

## Commands

```bash
# Install dependencies
uv sync

# Import data from CSV to Supabase
echo "IMPORT" | uv run python smart_import.py

# Run a one-off SQL script (dry run by default; --commit to apply)
uv run python scripts/db/run_sql.py scripts/db/<script>.sql

# Apply a migration — same runner, same dry-run-first habit
uv run python scripts/db/run_sql.py supabase/migrations/<file>.sql --commit
```

Migrations are **not** applied by any tooling. Nothing tracks which have run, so
check the schema before assuming one has. Apply them in numerical order, dry-run
first, and where a migration depends on an earlier one adding a column, apply
that one first rather than concatenating the files.

## Frontend (Next.js)

```bash
# Development
cd web && npm run dev

# Deploy to Vercel (from project root)
vercel --prod --cwd web

# First-time setup: link Vercel project
vercel link --cwd web
```

**Important:** The Next.js app lives in `web/`. Always use `--cwd web` when running Vercel CLI commands from the project root.

**Important:** Vercel does **not** auto-deploy from GitHub. Merging to `master`
ships nothing — production only changes when someone runs the deploy command
above. A production deploy had sat 120 days behind `master` before this was
noticed. When a change needs a migration *and* a deploy, apply the migration and
deploy together: the gap between them is a window where the live code and the
database disagree.

**Important:** `web/.env.local` points at the production Supabase project
(`jfgoonjqdspogbkjpgcb`) — the same database `scripts/db/` operates on. `npm run
dev` therefore reads and **writes live inventory**: a stock-check tick, bulk edit
or gallery reset against localhost changes real data. There is no staging
database.

## Project Structure

```
mum_art/
├── web/                # Next.js frontend (deployed to Vercel)
├── db/                 # Database models (SQLAlchemy) and manager
├── sync/               # CSV import logic
├── cleaning/           # Data standardization from Airtable format
├── airtable_export/    # Source CSV files
├── supabase/           # Database migrations
│   └── migrations/     # SQL schema files
├── planning/           # Project requirements (PRP docs)
├── scripts/db/         # One-off SQL fixes + dry-run runner (see its README)
└── smart_import.py     # Main import script
```

## Key Files
- `smart_import.py` - Import CSV data to Supabase
- `db/models.py` - SQLAlchemy ORM models
- `db/manager.py` - Database connection and operations
- `cleaning/cleaner.py` - Data transformation logic
- `supabase/migrations/001_initial_schema.sql` - Database schema
