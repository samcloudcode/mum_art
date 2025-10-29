# Art Database Migration System

High-performance data migration tool for transferring 8,400+ art edition records from Airtable CSV exports to PostgreSQL. Features intelligent duplicate handling, bulk imports, and comprehensive data standardization.

## Performance

- **Import Speed**: ~250 editions/second (35 seconds for full dataset)
- **Batch Processing**: 5,000 records per batch with PostgreSQL ON CONFLICT handling
- **Connection Pooling**: 10 persistent connections for optimal throughput
- **Smart Deduplication**: Pre-computed duplicate decisions for 76 known conflicts

## Features

- **Optimized Bulk Imports**: Uses PostgreSQL's native bulk insert with ON CONFLICT
- **Intelligent Data Cleaning**: Standardizes names, currencies, dates, and relationships
- **Duplicate Handling**: Automatic resolution of duplicate editions via decision matrix
- **Independent Architecture**: Database management separated from import logic
- **Full Sync Support**: Complete dataset replacement in under 40 seconds

## Project Structure

```
mum_art/
├── db/                       # Database layer
│   ├── models.py            # SQLAlchemy models with constraints
│   └── manager.py           # Connection pooling & operations
├── cleaning/                 # Data transformation
│   └── cleaner.py           # Smart name standardization & validation
├── sync/                     # Import engine
│   ├── importer_smart.py    # Optimized bulk import with ON CONFLICT
│   └── error_handler.py     # Comprehensive error recovery
├── airtable_export/         # Source CSV files (8,400+ records)
├── main.py                  # CLI interface
└── smart_import.py          # Quick import script
```

## Quick Start

### 1. Setup Environment

```bash
# Install dependencies
uv pip install -r requirements.txt

# Configure database
cp .env.example .env
# Edit .env with your PostgreSQL connection string
```

### 2. Run Full Import

```bash
# Quick import with duplicate handling
echo "IMPORT" | uv run python smart_import.py

# Or use the CLI
uv run python main.py sync --mode full
```

### 3. Verify Results

```bash
uv run python main.py db stats
```

## CLI Commands

### Database Management

```bash
# Create tables
uv run python main.py db create

# Show statistics
uv run python main.py db stats

# Reset database (WARNING: deletes all data)
uv run python main.py db reset
```

### Data Import

```bash
# Full sync (replaces all data) - 35 seconds
uv run python main.py sync --mode full

# Incremental sync (only updates)
uv run python main.py sync

# Validate data integrity
uv run python main.py validate
```

## Data Model

### Tables

1. **prints** (44 records)
   - Master catalog of print designs
   - Standardized names (e.g., "No Man's Fort" not "NoMansFort")
   - Unique constraint on name

2. **distributors** (23 records)
   - Galleries and sales channels
   - Commission rates 0-50%
   - Revenue tracking

3. **editions** (7,879 valid records)
   - Individual print editions
   - Each belongs to one print and optional distributor
   - Unique constraint on (print_id, edition_number)
   - Tracks sales, pricing, and location

4. **sync_logs**
   - Audit trail of all sync operations
   - Rollback capability

## Key Statistics

- **Total Editions**: 8,326 in source, 7,879 valid after cleaning
- **Duplicates Handled**: 76 automatically resolved
- **Missing Prints**: 371 editions skipped (unknown print names)
- **Sell-through Rate**: 45.9%
- **Total Revenue**: £579,938
- **Top Performer**: Lymington (97.1% sell-through)

## Technical Optimizations

1. **Connection Pooling**: Maintains 10 persistent database connections
2. **Bulk Inserts**: Uses psycopg2's `execute_values` for efficient bulk operations
3. **ON CONFLICT Handling**: Database-level duplicate resolution
4. **Batch Processing**: 5,000 records per batch minimizes round trips
5. **Smart Cleaning**: Pre-compiled regex patterns and cached lookups

## Development

```bash
# Test data cleaning
uv run python cleaning/cleaner.py

# Run with custom database URL
DATABASE_URL=postgresql://... uv run python main.py db stats
```

## License

Private - Internal Use Only