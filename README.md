# Art Print Inventory System

Art print inventory management system for tracking fine art editions as they move between home and galleries. Tracks print locations, sales status, and commissions.

**Frontend:** Next.js + Supabase Auth (in `web/` directory)
**Backend:** Supabase (PostgreSQL)
**Data Import:** Migration from Airtable CSV exports

> **There is no staging database.** `web/.env.local` and `.env` both point at the
> production Supabase project. `npm run dev` reads and **writes live inventory**,
> and so does every script here. See [CLAUDE.md](CLAUDE.md) for the details.

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

### 1. Setup Environment

```bash
# Install dependencies (dependencies live in pyproject.toml)
uv sync

# Configure database
cp .env.example .env
# Edit .env with your PostgreSQL connection string
```

An exported `DATABASE_URL` takes precedence over `.env`, so you can point any
script at a test database without editing files.

### 2. Run Import

```bash
echo "IMPORT" | uv run python smart_import.py
```

`smart_import.py` prompts for confirmation before writing. It is the only import
entry point — there is no subcommand CLI.

### 3. Inspect the Data

Live figures are in the app's dashboard. For ad-hoc queries, write a `.sql` file
and use the runner, which rolls back unless you pass `--commit`:

```bash
uv run python scripts/db/run_sql.py path/to/query.sql
```

See [scripts/db/README.md](scripts/db/README.md) for conventions on one-off
scripts, the dry-run guarantees, and the testing fixture.

## Frontend Development

The Next.js app lives in the `web/` directory.

### Local Development

```bash
cd web
npm install
npm run dev
```

Remember this talks to the production database.

### Deploy to Vercel

```bash
# From project root - use --cwd web flag
vercel --prod --cwd web

# First-time setup: link Vercel project
vercel link --cwd web
```

**Important:** Always use `--cwd web` when running Vercel CLI from the project root, since the Next.js app is in a subdirectory.

## Data Model

| Table | Description |
|-------|-------------|
| `prints` | Master catalog of print designs. Standardized names (e.g. "No Man's Fort" not "NoMansFort"), unique on name. |
| `distributors` | Galleries and sales channels. Commission rates 0–50%. |
| `editions` | Individual print editions. Each belongs to one print and optional distributor, unique on (print_id, edition_number). Tracks sales, pricing and location. |
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

## License

Private - Internal Use Only
