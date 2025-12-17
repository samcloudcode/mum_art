# CLAUDE.md

## Project Overview
Art print inventory management system for tracking fine art editions as they move between home and galleries. Tracks print locations, sales status, and commissions.

**Backend:** Supabase (PostgreSQL)
**Future Frontend:** Next.js + Supabase Auth (see `planning/PRP-nextjs-supabase-migration.md`)

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
```

## Project Structure

```
mum_art/
├── db/                 # Database models (SQLAlchemy) and manager
├── sync/               # CSV import logic
├── cleaning/           # Data standardization from Airtable format
├── airtable_export/    # Source CSV files
├── supabase/           # Database migrations
│   └── migrations/     # SQL schema files
├── planning/           # Project requirements (PRP docs)
├── smart_import.py     # Main import script
└── main.py             # CLI for database operations
```

## Key Files
- `smart_import.py` - Import CSV data to Supabase
- `db/models.py` - SQLAlchemy ORM models
- `db/manager.py` - Database connection and operations
- `cleaning/cleaner.py` - Data transformation logic
- `supabase/migrations/001_initial_schema.sql` - Database schema
