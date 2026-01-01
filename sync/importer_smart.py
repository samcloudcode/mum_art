"""Smart importer with duplicate handling."""

import pandas as pd
from pathlib import Path
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from typing import Dict, Set, List, Optional
from sqlalchemy.dialects.postgresql import insert

from db.models import Print, Distributor, Edition, SyncLog
from sync.import_report import ImportReport


class SmartImporter:
    """Optimized importer with intelligent duplicate handling."""

    # Assumptions made during import - documented in import_assumptions.md
    IMPORT_ASSUMPTIONS: List[Dict] = [
        {
            "category": "Data Quality",
            "assumption": "All imported data defaults to 'verified' status_confidence",
            "reason": "CSV data is considered the current best source of truth"
        },
        {
            "category": "Missing Data",
            "assumption": "If print name not found in database, edition record is skipped",
            "reason": "Editions require a valid print foreign key reference"
        },
        {
            "category": "Missing Data",
            "assumption": "If distributor name not found, distributor_id is set to NULL",
            "reason": "Distributor is optional - editions can exist without a distributor"
        },
        {
            "category": "Defaults",
            "assumption": "Unknown or missing sizes default to 'Small'",
            "reason": "Small is the most common edition size"
        },
        {
            "category": "Defaults",
            "assumption": "Unknown or missing frame types default to 'Framed'",
            "reason": "Most editions are framed when sold"
        },
        {
            "category": "Date Handling",
            "assumption": "Dates with year 1920 are corrected to 2020",
            "reason": "Common typo in manual data entry"
        },
        {
            "category": "Date Handling",
            "assumption": "Multiple date formats are tried (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)",
            "reason": "Historical data may have inconsistent date formatting"
        },
        {
            "category": "Commission",
            "assumption": "Commission percentage is a snapshot at sale time, not synced with current distributor rates",
            "reason": "Historical sales should reflect the commission at time of sale"
        },
        {
            "category": "Duplicates",
            "assumption": "Duplicate airtable_ids are rejected via ON CONFLICT DO NOTHING",
            "reason": "Each edition should have a unique source record"
        },
        {
            "category": "Settlement",
            "assumption": "Sales over 6 months old with sold=true are auto-marked as settled=true",
            "reason": "Old sales are unlikely to still be awaiting payment - conservative assumption for historical data"
        },
        {
            "category": "Legacy Data",
            "assumption": "Editions with 'Direct Old' distributor are marked as status_confidence='legacy_unknown'",
            "reason": "Direct Old indicates historical records with uncertain final status/location"
        },
    ]

    def __init__(self, db_manager, cleaner):
        """Initialize importer."""
        self.db = db_manager
        self.cleaner = cleaner
        self.sync_id = str(uuid4())
        self.post_processing_stats = {}
        # Create import report for tracking what was actually done
        self.import_report = ImportReport()
        # Attach report to cleaner so it can record transformations
        self.cleaner.report = self.import_report
        # Load skip indices (uses import_report, so must come after)
        self.skip_indices = self._load_skip_indices()

    def _load_skip_indices(self) -> Set[int]:
        """Load indices to skip from duplicate handling decisions."""
        skip_file = Path('duplicate_handling_decisions.csv')
        if not skip_file.exists():
            print("   ⚠️ No duplicate handling file found, will handle duplicates dynamically", flush=True)
            return set()

        try:
            df = pd.read_csv(skip_file)
            skip_df = df[df['action'] == 'SKIP']
            skip_rows = skip_df['index'].tolist()

            # Record each duplicate skip in the import report
            for _, row in skip_df.iterrows():
                edition_name = row.get('print_edition', 'Unknown')
                reason = row.get('decision', 'Duplicate')
                self.import_report.record_duplicate_skipped(edition_name, reason)

            print(f"   📋 Loaded {len(skip_rows)} rows to skip from duplicate handling", flush=True)
            return set(skip_rows)
        except Exception as e:
            print(f"   ⚠️ Could not load duplicate handling: {e}", flush=True)
            return set()

    def _mark_old_sales_as_settled(self) -> int:
        """Mark sales over 6 months old as settled.

        Business logic: Old sales that are marked as sold but not settled
        are unlikely to still be awaiting payment. This is a conservative
        assumption for cleaning up historical data.
        """
        six_months_ago = datetime.now().date() - timedelta(days=180)

        with self.db.get_session() as session:
            # Find sold editions older than 6 months that aren't settled
            updated = session.query(Edition).filter(
                Edition.is_sold.is_(True),
                Edition.is_settled.is_(False),
                Edition.date_sold.isnot(None),
                Edition.date_sold < six_months_ago
            ).update({Edition.is_settled: True}, synchronize_session=False)

            session.commit()
            return updated

    def _mark_direct_old_as_legacy_unknown(self) -> int:
        """Mark editions with 'Direct Old' distributor as legacy_unknown.

        The 'Direct Old' distributor indicates historical records where
        the final status/location is uncertain. These should be excluded
        from active inventory and stats by default.
        """
        with self.db.get_session() as session:
            # Find the 'Direct Old' distributor
            direct_old = session.query(Distributor).filter(
                Distributor.name.ilike('direct old')
            ).first()

            if not direct_old:
                print("   ℹ️ No 'Direct Old' distributor found", flush=True)
                return 0

            # Update all editions with this distributor
            updated = session.query(Edition).filter(
                Edition.distributor_id == direct_old.id
            ).update({Edition.status_confidence: 'legacy_unknown'}, synchronize_session=False)

            session.commit()
            return updated

    def _generate_assumptions_file(self) -> str:
        """Generate import_assumptions.md documenting all import assumptions and actions taken."""
        docs_dir = Path('docs')
        docs_dir.mkdir(exist_ok=True)
        output_path = docs_dir / 'import_assumptions.md'

        content = [
            "# Import Report",
            "",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Sync ID: {self.sync_id}",
            "",
        ]

        # Add the actual import report (what was done)
        content.append("# Actions Taken During This Import")
        content.append("")
        content.append("This section documents the actual transformations and actions")
        content.append("performed during this specific import run.")
        content.append("")
        content.append(self.import_report.generate_markdown())

        # Add post-processing stats
        if self.post_processing_stats:
            content.append("## Post-Processing Actions")
            content.append("")
            if 'old_sales_settled' in self.post_processing_stats:
                content.append(f"- **Old sales auto-settled:** {self.post_processing_stats['old_sales_settled']} editions (sales >6 months old)")
            if 'direct_old_marked' in self.post_processing_stats:
                content.append(f"- **Direct Old marked legacy_unknown:** {self.post_processing_stats['direct_old_marked']} editions")
            content.append("")

        # Add the static assumptions documentation
        content.append("---")
        content.append("")
        content.append("# Import Assumptions (Reference)")
        content.append("")
        content.append("This section documents the rules and assumptions the import process follows.")
        content.append("These are the configured behaviors, not necessarily what happened in this run.")
        content.append("")

        # Group assumptions by category
        categories = {}
        for assumption in self.IMPORT_ASSUMPTIONS:
            cat = assumption['category']
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(assumption)

        for category, assumptions in categories.items():
            content.append(f"## {category}")
            content.append("")
            for a in assumptions:
                content.append(f"### {a['assumption']}")
                content.append(f"**Reason:** {a['reason']}")
                content.append("")

        content.append("---")
        content.append("")
        content.append("To review editions marked as legacy_unknown, use the frontend toggle or query:")
        content.append("```sql")
        content.append("SELECT * FROM editions WHERE status_confidence = 'legacy_unknown';")
        content.append("```")

        output_path.write_text('\n'.join(content))
        return str(output_path)

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

        # Post-processing: Apply business rules
        print(f"\n🔧 Running post-processing...", flush=True)

        # Mark old sold items as settled
        old_sales_settled = self._mark_old_sales_as_settled()
        self.post_processing_stats['old_sales_settled'] = old_sales_settled
        print(f"   ✅ Marked {old_sales_settled} old sales (>6 months) as settled", flush=True)

        # Mark Direct Old distributor items as legacy_unknown
        direct_old_marked = self._mark_direct_old_as_legacy_unknown()
        self.post_processing_stats['direct_old_marked'] = direct_old_marked
        print(f"   ✅ Marked {direct_old_marked} 'Direct Old' editions as legacy_unknown", flush=True)

        # Generate assumptions documentation
        assumptions_file = self._generate_assumptions_file()
        print(f"   ✅ Generated {assumptions_file}", flush=True)

        results['post_processing'] = self.post_processing_stats

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
                            self.import_report.record_duplicate_print_skipped(cleaned['name'])
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
                            # Record edition skipped due to missing print
                            self.import_report.record_missing_print(
                                cleaned.get('edition_display_name', 'Unknown'),
                                cleaned.get('print_name', 'Unknown')
                            )
                            stats['failed'] += 1
                            continue
                    else:
                        stats['failed'] += 1
                        continue

                    # Always set distributor_id (even if None) to ensure consistent columns
                    distributor_name = cleaned.get('distributor_name')
                    cleaned['distributor_id'] = distributors.get(distributor_name)
                    # Record if distributor was not found
                    if distributor_name and not cleaned['distributor_id']:
                        self.import_report.record_missing_distributor(
                            cleaned.get('edition_display_name', 'Unknown')
                        )

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