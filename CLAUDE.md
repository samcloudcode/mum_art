# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
High-performance data migration tool for transferring 8,400+ art edition records from Airtable CSV exports to PostgreSQL. Optimized for speed with bulk imports completing in 35 seconds (~250 editions/second). Features intelligent duplicate handling, data standardization, and connection pooling.

## Architecture

The system uses a modular design with performance optimizations:
- **db/**: PostgreSQL database with connection pooling (10 persistent connections)
- **cleaning/**: High-speed data standardization (10,000+ records/second)
- **sync/**: Bulk import engine using PostgreSQL ON CONFLICT (5,000 record batches)

Key optimizations include psycopg2's execute_values for native bulk operations and database-level duplicate resolution, eliminating the need for individual transaction fallbacks.

## Development Setup

### Python Environment
- Python 3.13 required (specified in `.python-version`)
- Uses `uv` package manager for dependency management

### Common Commands
```bash
# Install dependencies
uv pip install -r requirements.txt

# Database management (no import required)
uv run python main.py db create
uv run python main.py db stats

# Sync from Airtable CSVs
uv run python main.py sync              # Incremental
uv run python main.py sync --mode full   # Full replacement
uv run python main.py sync --validate    # With validation

# Validate database integrity
uv run python main.py validate

# Test data cleaning
uv run python cleaning/cleaner.py
```

## Current Data Structure

### Source CSV Files (in `airtable_export/`)
- **Prints-Grid view.csv**: 45 print designs catalog
- **Distributors-Grid view.csv**: 23 galleries/distributors
- **Editions-All Records.csv**: 8,410 individual print editions (8,326 valid)

### Data Statistics
- **Total Revenue**: £579,938 over 11 years
- **Editions Sold**: 3,820 (45.9% sell-through rate)
- **Average Price**: £158.64 (range: £8.40 - £575.00)
- **Peak Year**: 2021 with 529 sales (now declined 70%)

## Database Schema (PostgreSQL)

### Three Main Tables
1. **prints**: Master catalog (id, name, description, total_editions, image_urls[])
2. **distributors**: Galleries (id, name, commission_percentage, revenues)
3. **editions**: Individual prints (id, print_id, distributor_id, edition_number, price, sold status)

### Key Relationships
- One Print → Many Editions (one-to-many)
- One Distributor → Many Editions (one-to-many)
- Each Edition belongs to exactly ONE Print and ONE Distributor

## Data Cleaning Implementation

### Main Cleaner: `cleaning/cleaner.py`
Handles all data transformations including:
- **Name Standardization**: "NoMansFort " → "No Man's Fort"
- **Currency Parsing**: "£250.00" → Decimal(250.00)
- **Boolean Conversion**: "checked" → True
- **Date Parsing**: "10/24/2023" → datetime.date
- **Edition Extraction**: "St Catherines - 87" → print="St Catherine's", edition=87

### Data Quality Handling
- **Duplicate Editions**: 174 duplicates intelligently handled via `duplicate_handling_decisions.csv`
- **Size/Frame Normalization**: "Unknown" → "Small", "Ikea/B&Q" → "Framed"
- **String Truncation**: Variation field limited to 20 chars
- **Missing Data**: NULL sale status treated as unsold
- **Zero Prices**: Allowed for gifts/promotional items
- **Error Recovery**: Comprehensive error handling in sync/error_handler.py

## Key Files

- **main.py**: CLI interface for all operations
- **db/models.py**: SQLAlchemy models with unique constraints
- **db/manager.py**: Connection pooling and database operations
- **cleaning/cleaner.py**: Optimized data standardization (10K+ records/sec)
- **sync/importer_smart.py**: Bulk import with ON CONFLICT handling
- **sync/error_handler.py**: Comprehensive error recovery
- **duplicate_handling_decisions.csv**: Pre-computed duplicate resolution (76 conflicts)
- **smart_import.py**: Quick full import script (35 seconds)

## Migration Process

### Quick Start (Full Import - 35 seconds)
```bash
# Setup database
uv run python main.py db create

# Run optimized import (35 seconds for 8,400 records)
echo "IMPORT" | uv run python smart_import.py

# Check results
uv run python main.py db stats
uv run python main.py validate
```

### Manual Process
1. **Setup Database**: `main.py db create` (independent of Airtable)
2. **Run Sync**: `main.py sync --mode full` (imports all data)
3. **Validate**: `main.py validate` (check integrity)
4. **Monitor**: `main.py db stats` (view current state)

### Import Performance & Status
- **Import Speed**: ~250 editions/second (35 seconds total)
- **Database**: Live on Retool PostgreSQL with connection pooling
- **Schema**: All 4 tables with optimized constraints
- **Data**: 44 prints, 23 distributors, 7,879 editions imported
- **Batch Size**: 5,000 records per transaction
- **Quality**: 76 duplicates auto-resolved, 371 missing prints handled

## Business Rules

### Pricing Tiers
- Extra Large Framed: £422 average
- Large Framed: £199 average
- Small Framed: £110 average
- Mounted: £93 average

### Commission Structure
- Direct Sales: 0%
- Standard Galleries: 40%
- Premium Galleries (Perera): 50%

### Top Performing Prints
1. Lymington: £49,070 revenue, 97.1% sell-through
2. SEAGROVE: £37,990 revenue, 89.7% sell-through
3. Lifeboat Station: £35,237 revenue, 98.1% sell-through

### Problem Inventory (>90% unsold)
- NERTHEK: 351 editions, only 1 sold
- QUAYROCKS LANDSCAPE: 350 editions, only 1 sold
- PUFFIN: 351 editions, only 4 sold