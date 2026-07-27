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
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:6543/postgres
```

### Tables
| Table | Records | Description |
|-------|---------|-------------|
| prints | 44 | Master catalog of artwork designs |
| distributors | 23 | Galleries and locations |
| editions | 7,879 | Individual physical prints |
| sync_logs | - | Import audit trail |
| profiles | - | User profiles (for auth) |
| activity_log | - | Audit trail of user changes; one row per changed field |

### Key Relationships
- One Print -> Many Editions
- One Distributor -> Many Editions
- Each Edition belongs to exactly ONE Print and ONE Distributor

## Commands

```bash
# Install dependencies
uv pip install

# Import data from CSV to Supabase
echo "IMPORT" | uv run python smart_import.py

# Check database stats
uv run python main.py db stats

# Run a one-off SQL script (dry run by default; --commit to apply)
uv run python scripts/db/run_sql.py scripts/db/<script>.sql
```

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
├── smart_import.py     # Main import script
└── main.py             # CLI for database operations
```

## Key Files
- `smart_import.py` - Import CSV data to Supabase
- `db/models.py` - SQLAlchemy ORM models
- `db/manager.py` - Database connection and operations
- `cleaning/cleaner.py` - Data transformation logic
- `supabase/migrations/001_initial_schema.sql` - Database schema
