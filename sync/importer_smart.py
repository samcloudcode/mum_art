"""Smart importer with duplicate handling."""

import pandas as pd
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4
from typing import Dict, Set
from sqlalchemy.dialects.postgresql import insert

from db.models import Print, Distributor, Edition, SyncLog


class SmartImporter:
    """Optimized importer with intelligent duplicate handling."""

    def __init__(self, db_manager, cleaner):
        """Initialize importer."""
        self.db = db_manager
        self.cleaner = cleaner
        self.sync_id = str(uuid4())
        self.skip_indices = self._load_skip_indices()

    def _load_skip_indices(self) -> Set[int]:
        """Load indices to skip from duplicate handling decisions."""
        skip_file = Path('duplicate_handling_decisions.csv')
        if not skip_file.exists():
            print("   ⚠️ No duplicate handling file found, will handle duplicates dynamically", flush=True)
            return set()

        try:
            df = pd.read_csv(skip_file)
            skip_rows = df[df['action'] == 'SKIP']['index'].tolist()
            print(f"   📋 Loaded {len(skip_rows)} rows to skip from duplicate handling", flush=True)
            return set(skip_rows)
        except Exception as e:
            print(f"   ⚠️ Could not load duplicate handling: {e}", flush=True)
            return set()

    def sync_all(self, prints_csv: str, dist_csv: str, editions_csv: str) -> Dict:
        """Run full sync with duplicate handling."""
        print(f"\n🚀 Starting SMART sync (ID: {self.sync_id[:8]}...)", flush=True)

        # Clear all tables in reverse order to respect foreign keys
        print(f"\n🗑️ Clearing existing data...", flush=True)
        with self.db.get_session() as session:
            session.query(Edition).delete()
            session.query(Distributor).delete()
            session.query(Print).delete()
            session.commit()
            print(f"   ✅ Tables cleared", flush=True)

        results = {
            'prints': self._sync_prints_smart(prints_csv),
            'distributors': self._sync_distributors_smart(dist_csv),
            'editions': self._sync_editions_smart(editions_csv)
        }

        print(f"\n✅ Smart sync completed!", flush=True)
        return results

    def _sync_prints_smart(self, csv_path: str) -> Dict:
        """Sync prints with duplicate name handling."""
        print(f"\n📚 Syncing Prints...", flush=True)
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
        print(f"   Processing {len(df)} prints", flush=True)

        stats = {'created': 0, 'updated': 0, 'skipped': 0}

        with self.db.get_session() as session:

            seen_names = set()
            for idx, row in df.iterrows():
                try:
                    cleaned = self.cleaner.clean_print_data(row.to_dict())
                    if cleaned.get('airtable_id') and cleaned.get('name'):
                        # Skip duplicate names
                        if cleaned['name'] in seen_names:
                            stats['skipped'] += 1
                            print(f"   ⚠️ Skipping duplicate print: {cleaned['name']}", flush=True)
                            continue

                        seen_names.add(cleaned['name'])
                        print_ = Print(**cleaned)
                        print_.last_synced_at = datetime.now(timezone.utc)
                        session.add(print_)
                        stats['created'] += 1
                except Exception as e:
                    print(f"   ⚠️ Error on row {idx}: {e}", flush=True)
                    stats['skipped'] += 1

            session.commit()
            print(f"   ✅ {stats['created']} prints imported, {stats['skipped']} skipped", flush=True)

        return stats

    def _sync_distributors_smart(self, csv_path: str) -> Dict:
        """Sync distributors."""
        print(f"\n🏪 Syncing Distributors...", flush=True)
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
        print(f"   Processing {len(df)} distributors", flush=True)

        stats = {'created': 0, 'updated': 0, 'skipped': 0}

        with self.db.get_session() as session:

            for idx, row in df.iterrows():
                try:
                    cleaned = self.cleaner.clean_distributor_data(row.to_dict())
                    if cleaned.get('airtable_id') and cleaned.get('name'):
                        dist = Distributor(**cleaned)
                        dist.last_synced_at = datetime.now(timezone.utc)
                        session.add(dist)
                        stats['created'] += 1
                except Exception as e:
                    print(f"   ⚠️ Error on row {idx}: {e}", flush=True)
                    stats['skipped'] += 1

            session.commit()
            print(f"   ✅ {stats['created']} distributors imported", flush=True)

        return stats

    def _sync_editions_smart(self, csv_path: str) -> Dict:
        """Sync editions with PostgreSQL ON CONFLICT for fast bulk inserts."""
        print(f"\n🎨 Syncing Editions with optimized bulk insert...", flush=True)
        df = pd.read_csv(csv_path, encoding='utf-8-sig')

        # Filter valid editions
        valid_df = df[(df['Print - Edition'] != ' - ') & (df['Print - Edition'].notna())]
        print(f"   Found {len(valid_df)} valid editions", flush=True)

        # Filter out duplicates based on our decisions
        if self.skip_indices:
            before_count = len(valid_df)
            valid_df = valid_df[~valid_df.index.isin(self.skip_indices)]
            print(f"   Skipping {before_count - len(valid_df)} duplicate editions", flush=True)

        print(f"   Processing {len(valid_df)} editions after duplicate removal", flush=True)

        stats = {'created': 0, 'skipped': 0, 'failed': 0, 'duplicates_ignored': 0}

        # Build lookups first
        with self.db.get_session() as session:
            prints = {p.name: p.id for p in session.query(Print).all()}
            distributors = {d.name: d.id for d in session.query(Distributor).all()}

        print(f"   Lookups: {len(prints)} prints, {len(distributors)} distributors", flush=True)

        # Process in larger batches for better performance
        batch_size = 5000  # Increased for optimal PostgreSQL performance
        with self.db.get_session() as session:

            batch_mappings = []
            for idx, row in valid_df.iterrows():
                try:
                    cleaned = self.cleaner.clean_edition_data(row.to_dict())
                    if not cleaned.get('airtable_id'):
                        stats['skipped'] += 1
                        continue

                    # Resolve foreign keys
                    if cleaned.get('print_name'):
                        cleaned['print_id'] = prints.get(cleaned['print_name'])
                        if not cleaned['print_id']:
                            stats['failed'] += 1
                            continue
                    else:
                        stats['failed'] += 1
                        continue

                    # Always set distributor_id (even if None) to ensure consistent columns
                    cleaned['distributor_id'] = distributors.get(cleaned.get('distributor_name'))

                    # Remove lookup fields
                    cleaned.pop('print_name', None)
                    cleaned.pop('distributor_name', None)
                    cleaned.pop('print_airtable_id', None)
                    cleaned.pop('distributor_airtable_id', None)

                    # Add sync metadata
                    cleaned['last_synced_at'] = datetime.now(timezone.utc)

                    # Keep all fields for consistent column mapping in bulk insert
                    # (removing None values would create inconsistent column sets)
                    batch_mappings.append(cleaned)

                    # Insert batch when full using ON CONFLICT
                    if len(batch_mappings) >= batch_size:
                        inserted = self._bulk_insert_editions(session, batch_mappings)
                        stats['created'] += inserted
                        stats['duplicates_ignored'] += len(batch_mappings) - inserted
                        print(f"   Processed {stats['created']} editions...", flush=True)
                        batch_mappings = []

                except Exception as e:
                    print(f"   ⚠️ Error on edition {idx}: {e}", flush=True)
                    stats['failed'] += 1

            # Insert remaining batch
            if batch_mappings:
                inserted = self._bulk_insert_editions(session, batch_mappings)
                stats['created'] += inserted
                stats['duplicates_ignored'] += len(batch_mappings) - inserted

            print(f"\n   ✅ Results:")
            print(f"      Created: {stats['created']} editions")
            print(f"      Skipped: {stats['skipped']} (no airtable_id)")
            print(f"      Failed: {stats['failed']} (missing print)")
            print(f"      Duplicates ignored: {stats['duplicates_ignored']}")

        return stats

    def _bulk_insert_editions(self, session, mappings):
        """Bulk insert editions using raw SQL for better performance."""
        if not mappings:
            return 0

        # Prepare the data for insertion
        from psycopg2.extras import execute_values

        # Get the raw database connection
        connection = session.connection().connection
        cursor = connection.cursor()

        # Define columns to insert
        columns = list(mappings[0].keys())

        # Create the SQL statement with ON CONFLICT
        sql = f"""
            INSERT INTO editions ({', '.join(columns)})
            VALUES %s
            ON CONFLICT (airtable_id) DO NOTHING
            RETURNING id
        """

        # Convert mappings to tuples
        values = [tuple(mapping.get(col) for col in columns) for mapping in mappings]

        try:
            # Use psycopg2's execute_values for efficient bulk insert
            result = execute_values(cursor, sql, values, fetch=True)
            connection.commit()
            return len(result) if result else 0
        except Exception as e:
            connection.rollback()
            # Fallback to SQLAlchemy method if raw SQL fails
            print(f"   ⚠️ Raw SQL failed, using SQLAlchemy: {e}")
            stmt = insert(Edition).values(mappings)
            stmt = stmt.on_conflict_do_nothing()
            result = session.execute(stmt)
            session.commit()
            return result.rowcount