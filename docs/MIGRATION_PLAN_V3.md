# Migration Plan V3 - Separated Database Management & Sync

## Architecture Overview

The system is split into three independent modules:

1. **Database Management** (`db/`) - PostgreSQL schema and operations
2. **Data Cleaning** (`cleaning/`) - Airtable data standardization
3. **Sync Engine** (`sync/`) - Import/update from Airtable exports

This separation allows you to:
- Manage the PostgreSQL database independently
- Run multiple test imports without affecting production
- Gradually transition from Airtable while maintaining both systems
- Perform incremental updates rather than full replacements

## Module 1: Database Management (`db/`)

### `db/models.py` - SQLAlchemy Models
```python
from sqlalchemy import create_engine, Column, Integer, String, Text, DECIMAL, Boolean, Date, TIMESTAMP, ForeignKey, ARRAY, CheckConstraint, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Print(Base):
    __tablename__ = 'prints'

    id = Column(Integer, primary_key=True)
    airtable_id = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    total_editions = Column(Integer)
    web_link = Column(String(500))
    notes = Column(Text)
    image_urls = Column(ARRAY(Text))

    # Sync metadata
    last_synced_at = Column(TIMESTAMP)
    sync_version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    editions = relationship("Edition", back_populates="print")

class Distributor(Base):
    __tablename__ = 'distributors'

    id = Column(Integer, primary_key=True)
    airtable_id = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False, unique=True)
    commission_percentage = Column(DECIMAL(5,2))
    notes = Column(Text)
    contact_number = Column(String(50))
    web_address = Column(String(500))

    # Financial fields
    net_revenue = Column(DECIMAL(10,2))
    distributor_revenue = Column(DECIMAL(10,2))
    retail_amount_sold = Column(DECIMAL(10,2))
    net_revenue_unpaid = Column(DECIMAL(10,2))
    net_revenue_unpaid_by_invoice_month = Column(DECIMAL(10,2))
    last_update_date = Column(Date)

    # Sync metadata
    last_synced_at = Column(TIMESTAMP)
    sync_version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    editions = relationship("Edition", back_populates="distributor")

class Edition(Base):
    __tablename__ = 'editions'

    id = Column(Integer, primary_key=True)
    airtable_id = Column(String(20), unique=True, nullable=False)

    # Foreign Keys
    print_id = Column(Integer, ForeignKey('prints.id'), nullable=False)
    distributor_id = Column(Integer, ForeignKey('distributors.id'))

    # Edition Identity
    edition_number = Column(Integer)
    edition_display_name = Column(String(100), nullable=False)

    # Physical Attributes
    size = Column(String(20))
    frame_type = Column(String(20))
    variation = Column(String(20))

    # Status Flags
    is_printed = Column(Boolean, default=False)
    is_sold = Column(Boolean, default=False)
    is_settled = Column(Boolean, default=False)
    is_stock_checked = Column(Boolean, default=False)
    to_check_in_detail = Column(Boolean, default=False)

    # Sales Information
    retail_price = Column(DECIMAL(10,2))
    date_sold = Column(Date)
    invoice_amount = Column(DECIMAL(10,2))
    commission_percentage = Column(DECIMAL(5,2))
    commission_amount = Column(DECIMAL(10,2))

    # Gallery Tracking
    date_in_gallery = Column(Date)
    weeks_in_gallery = Column(Integer)

    # Additional Info
    notes = Column(Text)
    payment_note = Column(Text)
    month_sold = Column(String(20))
    year_sold = Column(Integer)

    # Sync metadata
    last_synced_at = Column(TIMESTAMP)
    sync_version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    print = relationship("Print", back_populates="editions")
    distributor = relationship("Distributor", back_populates="editions")

    # Constraints
    __table_args__ = (
        UniqueConstraint('print_id', 'edition_number', name='unique_print_edition'),
        CheckConstraint("size IN ('Small', 'Large', 'Extra Large')", name='check_size'),
        CheckConstraint("frame_type IN ('Framed', 'Tube only', 'Mounted')", name='check_frame_type'),
    )

class SyncLog(Base):
    """Track sync operations for audit and rollback"""
    __tablename__ = 'sync_logs'

    id = Column(Integer, primary_key=True)
    sync_id = Column(String(50), nullable=False)  # UUID for this sync operation
    sync_type = Column(String(20))  # 'full', 'incremental', 'manual'
    table_name = Column(String(50))

    records_processed = Column(Integer)
    records_created = Column(Integer)
    records_updated = Column(Integer)
    records_deleted = Column(Integer)
    records_failed = Column(Integer)

    started_at = Column(TIMESTAMP, nullable=False)
    completed_at = Column(TIMESTAMP)
    status = Column(String(20))  # 'running', 'completed', 'failed', 'rolled_back'
    error_message = Column(Text)

    source_file = Column(String(255))
    source_hash = Column(String(64))  # SHA256 of source file for deduplication
```

### `db/manager.py` - Database Operations
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager
import os
from dotenv import load_dotenv

load_dotenv()

class DatabaseManager:
    """Manage PostgreSQL database operations independently of imports"""

    def __init__(self, connection_string=None):
        self.connection_string = connection_string or os.getenv('DATABASE_URL')
        self.engine = create_engine(self.connection_string)
        self.SessionLocal = sessionmaker(bind=self.engine)

    def create_tables(self):
        """Create all tables in the database"""
        Base.metadata.create_all(self.engine)
        print("✅ Database tables created")

    def drop_tables(self):
        """Drop all tables (use with caution!)"""
        Base.metadata.drop_all(self.engine)
        print("⚠️ Database tables dropped")

    def reset_database(self):
        """Reset database to clean state"""
        self.drop_tables()
        self.create_tables()
        print("🔄 Database reset complete")

    @contextmanager
    def get_session(self):
        """Provide a transactional scope for database operations"""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_table_stats(self):
        """Get current record counts for all tables"""
        with self.get_session() as session:
            stats = {
                'prints': session.query(Print).count(),
                'distributors': session.query(Distributor).count(),
                'editions': session.query(Edition).count(),
                'sync_logs': session.query(SyncLog).count(),
            }
            return stats

    def backup_database(self, filepath):
        """Export database to SQL dump"""
        # Implementation depends on PostgreSQL access
        pass

    def restore_database(self, filepath):
        """Restore database from SQL dump"""
        # Implementation depends on PostgreSQL access
        pass
```

## Module 2: Data Cleaning (`cleaning/`)

### `cleaning/cleaner.py`
```python
# This is essentially data_cleaner_v2.py
# Keeps all data transformation logic separate from database operations
from data_cleaner_v2 import DataCleanerV2

class AirtableDataCleaner(DataCleanerV2):
    """Extended cleaner with validation specific to our business rules"""

    @staticmethod
    def prepare_print_for_db(row_dict):
        """Transform Airtable print row to database-ready format"""
        cleaned = DataCleanerV2.clean_print_data(row_dict)
        # Add any additional business logic
        return cleaned

    @staticmethod
    def prepare_distributor_for_db(row_dict):
        """Transform Airtable distributor row to database-ready format"""
        cleaned = DataCleanerV2.clean_distributor_data(row_dict)
        return cleaned

    @staticmethod
    def prepare_edition_for_db(row_dict):
        """Transform Airtable edition row to database-ready format"""
        cleaned = DataCleanerV2.clean_edition_data(row_dict)
        return cleaned
```

## Module 3: Sync Engine (`sync/`)

### `sync/importer.py`
```python
import pandas as pd
import hashlib
from datetime import datetime
from uuid import uuid4

class AirtableImporter:
    """Import and sync data from Airtable CSV exports"""

    def __init__(self, db_manager, cleaner):
        self.db = db_manager
        self.cleaner = cleaner
        self.sync_id = None

    def sync_from_csvs(self, prints_csv, distributors_csv, editions_csv, mode='incremental'):
        """
        Sync data from CSV files to database

        Modes:
        - 'incremental': Only add/update changed records
        - 'full': Replace all data (marks old as inactive)
        - 'merge': Update existing, add new, keep unchanged
        """
        self.sync_id = str(uuid4())

        try:
            # Log sync start
            self._log_sync_start(mode)

            # Phase 1: Sync Prints (no dependencies)
            print_stats = self._sync_prints(prints_csv, mode)

            # Phase 2: Sync Distributors (no dependencies)
            dist_stats = self._sync_distributors(distributors_csv, mode)

            # Phase 3: Sync Editions (depends on prints & distributors)
            edition_stats = self._sync_editions(editions_csv, mode)

            # Log sync completion
            self._log_sync_complete(print_stats, dist_stats, edition_stats)

            return {
                'sync_id': self.sync_id,
                'prints': print_stats,
                'distributors': dist_stats,
                'editions': edition_stats
            }

        except Exception as e:
            self._log_sync_error(str(e))
            raise

    def _sync_prints(self, csv_path, mode):
        """Sync prints table from CSV"""
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
        stats = {'created': 0, 'updated': 0, 'skipped': 0}

        with self.db.get_session() as session:
            for _, row in df.iterrows():
                cleaned = self.cleaner.prepare_print_for_db(row.to_dict())

                # Check if exists
                existing = session.query(Print).filter_by(
                    airtable_id=cleaned['airtable_id']
                ).first()

                if existing:
                    if mode in ['incremental', 'merge', 'full']:
                        # Update existing record
                        for key, value in cleaned.items():
                            if hasattr(existing, key):
                                setattr(existing, key, value)
                        existing.last_synced_at = datetime.utcnow()
                        existing.sync_version += 1
                        stats['updated'] += 1
                    else:
                        stats['skipped'] += 1
                else:
                    # Create new record
                    new_print = Print(**cleaned)
                    new_print.last_synced_at = datetime.utcnow()
                    session.add(new_print)
                    stats['created'] += 1

            session.commit()

        return stats

    def rollback_sync(self, sync_id):
        """Rollback a specific sync operation"""
        # Implementation: revert to previous sync_version
        pass

    def validate_import(self):
        """Run validation checks after import"""
        issues = []

        with self.db.get_session() as session:
            # Check for orphaned editions
            orphaned = session.query(Edition).filter(
                Edition.print_id.is_(None)
            ).count()
            if orphaned:
                issues.append(f"{orphaned} editions without prints")

            # Check for duplicate names
            # ... more validation rules

        return issues
```

### `sync/scheduler.py`
```python
class SyncScheduler:
    """Schedule and manage regular syncs from Airtable"""

    def __init__(self, importer):
        self.importer = importer

    def daily_sync(self):
        """Run daily incremental sync"""
        # Check for new CSV exports
        # Run incremental sync
        # Send notifications
        pass

    def check_for_changes(self, csv_path):
        """Check if CSV has changed since last sync"""
        # Compare file hash with last sync
        pass
```

## Usage Examples

### Initial Setup
```python
from db.manager import DatabaseManager
from cleaning.cleaner import AirtableDataCleaner
from sync.importer import AirtableImporter

# Step 1: Set up database (one-time)
db = DatabaseManager()
db.create_tables()

# Step 2: Check database status
stats = db.get_table_stats()
print(f"Database ready: {stats}")
```

### Running a Sync
```python
# Initialize components
db = DatabaseManager()
cleaner = AirtableDataCleaner()
importer = AirtableImporter(db, cleaner)

# Run incremental sync
results = importer.sync_from_csvs(
    prints_csv='airtable_export/Prints-Grid view.csv',
    distributors_csv='airtable_export/Distributors-Grid view.csv',
    editions_csv='airtable_export/Editions-All Records.csv',
    mode='incremental'
)

print(f"Sync complete: {results}")

# Validate the import
issues = importer.validate_import()
if issues:
    print(f"Validation issues: {issues}")
```

### Database Management
```python
# View current state
db = DatabaseManager()
stats = db.get_table_stats()
print(f"Current database: {stats}")

# Backup before major changes
db.backup_database('backup_20251029.sql')

# Reset if needed (development only!)
if environment == 'development':
    db.reset_database()
```

## Transition Strategy

### Phase 1: Parallel Operation (Current)
- PostgreSQL database created and managed independently
- Daily syncs from Airtable CSV exports
- Both systems operate in parallel
- Validate data consistency

### Phase 2: PostgreSQL Primary (Transition)
- Application reads from PostgreSQL
- Airtable updated less frequently
- Monitor for issues
- Maintain sync capability for rollback

### Phase 3: PostgreSQL Only (Final)
- Airtable becomes read-only archive
- All operations through PostgreSQL
- Remove sync dependencies
- Final data migration validation

## Benefits of This Architecture

1. **Independence**: Database schema evolves independently of Airtable
2. **Safety**: Can test imports without affecting production
3. **Flexibility**: Support multiple sync strategies (full/incremental/merge)
4. **Auditability**: Complete sync history with rollback capability
5. **Gradual Transition**: Move at your own pace with fallback options
6. **Validation**: Built-in checks ensure data integrity

## File Structure
```
mum_art/
├── db/
│   ├── __init__.py
│   ├── models.py          # SQLAlchemy models
│   └── manager.py         # Database operations
├── cleaning/
│   ├── __init__.py
│   └── cleaner.py         # Data transformation
├── sync/
│   ├── __init__.py
│   ├── importer.py        # CSV import logic
│   └── scheduler.py       # Sync automation
├── airtable_export/       # CSV files
│   ├── Prints-Grid view.csv
│   ├── Distributors-Grid view.csv
│   └── Editions-All Records.csv
├── main.py                # CLI interface
├── .env                   # Database credentials
└── requirements.txt       # Python dependencies
```