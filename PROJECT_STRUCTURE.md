# Project Structure

## Core Application Files
- `main.py` - Main CLI interface for database operations
- `smart_import.py` - Optimized full import script (35 seconds for 8,400 records)
- `duplicate_handling_decisions.csv` - Pre-computed duplicate resolution rules

## Directory Organization

### `/airtable_export/`
Source CSV files from Airtable:
- Original exports and cleaned versions
- Prints, Distributors, and Editions data

### `/db/`
Database layer:
- `models.py` - SQLAlchemy models for prints, distributors, editions, sync_logs
- `manager.py` - Connection pooling and database operations

### `/sync/`
Data synchronization:
- `importer_smart.py` - Bulk import with ON CONFLICT handling
- `error_handler.py` - Comprehensive error recovery

### `/cleaning/`
Data transformation:
- `cleaner.py` - High-speed data standardization (10K+ records/sec)

### `/analysis/`
Data analysis scripts:
- `deep_dive_analysis.py` - Detailed business metrics and insights
- `quick_analysis.py` - Fast overview of database state

### `/audit/`
Audit and tracking system:
- `create_audit_system.py` - Sets up audit tables
- `audit_viewer.py` - View audit logs
- `retool_audit_queries.sql` - SQL queries for Retool dashboards
- `test_audit.py` - Audit system tests

### `/utilities/`
Maintenance and fix scripts:
- `check_distributors.py` - Verify distributor links
- `fix_distributor_links.py` - Repair broken distributor references
- `fix_distributor_links_fast.py` - Optimized version
- `final_verification.py` - Data integrity checks

### `/docs/`
Additional documentation:
- `AUDIT_SYSTEM.md` - Audit system design
- `RETOOL_AUDIT_SETUP.md` - Retool integration guide
- `MIGRATION_PLAN_V3.md` - Original migration planning
- `FINAL_STATUS.md` - Project completion status
- `TODO.md` - Outstanding tasks

## Configuration Files
- `.env` - Environment variables (DATABASE_URL)
- `.env.example` - Template for environment setup
- `.python-version` - Python 3.13 requirement
- `requirements.txt` - Python dependencies
- `pyproject.toml` - Project metadata
- `.gitignore` - Git ignore rules
- `CLAUDE.md` - AI assistant instructions
- `README.md` - Project overview

## Quick Start Commands

```bash
# Setup database
uv run python main.py db create

# Import all data (35 seconds)
echo "IMPORT" | uv run python smart_import.py

# Check status
uv run python main.py db stats

# Run analysis
uv run python analysis/quick_analysis.py
```