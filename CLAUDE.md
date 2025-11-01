# CLAUDE.md

## Project Overview
Art print inventory management system for tracking fine art editions as they move between home and galleries. Tracks print locations, sales status, and commissions.

## Business Context
- Artist creates original print designs (artwork)
- Each design has multiple numbered editions (e.g., 1/350, 2/350)
- All edition records are pre-created upfront, then marked as `is_printed` when physically produced
- Editions move between "Direct" (artist's home, 0% commission) and galleries (40-50% commission)
- System tracks: printing status, framing, location, sales, and payment settlement

## Database Schema

### Core Tables
1. **prints** - Master catalog of artwork designs (44 records)
   - `name`, `total_editions`, `description`, `image_urls[]`

2. **distributors** - Galleries and locations (23 records)
   - `name`, `commission_percentage` (0% for Direct, 40-50% for galleries)

3. **editions** - Individual physical prints (7,879 records)
   - Links to: `print_id`, `distributor_id`
   - Status: `is_printed`, `is_sold`, `is_settled`, `frame_type`
   - Details: `edition_number`, `retail_price`, `date_sold`

### Key Relationships
- One Print → Many Editions (one-to-many)
- One Distributor → Many Editions (one-to-many)
- Each Edition belongs to exactly ONE Print and ONE Distributor

## Common Operations

```bash
# Setup
uv pip install -r requirements.txt
uv run python main.py db create

# Import data (35 seconds)
echo "IMPORT" | uv run python smart_import.py

# Check status
uv run python main.py db stats
uv run python analysis/quick_analysis.py
```

## Project Structure

### Core Directories
- **db/** - Database models and manager
- **sync/** - Data import from Airtable CSVs
- **cleaning/** - Data standardization
- **analysis/** - Business insights scripts
- **utilities/** - Maintenance and fixes
- **airtable_export/** - Source CSV files

### Key Files
- `main.py` - CLI for database operations
- `smart_import.py` - Fast bulk import (35 seconds)
- `PROJECT_STRUCTURE.md` - Full file organization