#!/usr/bin/env python
"""
Smart Import Script - Import Airtable CSV data to Supabase PostgreSQL

This is the main entry point for importing art print inventory data.
It clears all existing data and performs a fresh import from CSV files.

Usage:
    echo "IMPORT" | uv run python smart_import.py

Required CSV files (in airtable_export/):
    - Prints-Grid view.csv
    - Distributors-Grid view clean.csv
    - Editions-All Records clean.csv

Optional:
    - duplicate_handling_decisions.csv: Pre-defined rules for handling
      duplicate edition records. Format: index,edition,size,frame,...,action
      where action is 'KEEP' or 'SKIP'.

The script will:
    1. Validate CSV files exist
    2. Connect to Supabase database (using DATABASE_URL from .env)
    3. Clear all existing data (prints, distributors, editions)
    4. Import prints, then distributors, then editions
    5. Report import statistics
"""

import sys
from pathlib import Path

from db.manager import DatabaseManager
from cleaning.cleaner import AirtableDataCleaner
from sync.importer_smart import SmartImporter

def main():
    print("🧠 Smart Import Script (with duplicate handling)", flush=True)

    # Check CSV files - using clean versions without calculated fields
    csv_dir = Path('airtable_export')
    prints_csv = csv_dir / 'Prints-Grid view.csv'  # No clean version for prints
    dist_csv = csv_dir / 'Distributors-Grid view clean.csv'  # Use clean version
    editions_csv = csv_dir / 'Editions-All Records clean.csv'  # Use clean version

    for csv_file in [prints_csv, dist_csv, editions_csv]:
        if not csv_file.exists():
            print(f"❌ Missing: {csv_file}")
            return 1

    # Check duplicate handling file
    dup_file = Path('duplicate_handling_decisions.csv')
    if dup_file.exists():
        print(f"✅ Using duplicate handling from: {dup_file}")
    else:
        print(f"⚠️ No duplicate handling file - will handle dynamically")

    # Initialize components
    db = DatabaseManager()
    if not db.check_connection():
        return 1

    # Confirm reset
    print("\n⚠️ This will REPLACE all data in the database!")
    response = input("Type 'IMPORT' to continue: ")
    if response != 'IMPORT':
        print("Cancelled.")
        return 0

    cleaner = AirtableDataCleaner()
    importer = SmartImporter(db, cleaner)

    # Run smart sync
    try:
        results = importer.sync_all(
            str(prints_csv),
            str(dist_csv),
            str(editions_csv)
        )

        print(f"\n📊 Import Results:")
        print(f"   Prints: {results['prints']}")
        print(f"   Distributors: {results['distributors']}")
        print(f"   Editions: {results['editions']}")

        if 'post_processing' in results:
            pp = results['post_processing']
            print(f"\n🔧 Post-Processing:")
            print(f"   Old sales auto-settled: {pp.get('old_sales_settled', 0)}")
            print(f"   Direct Old marked legacy: {pp.get('direct_old_marked', 0)}")

        # Get final stats
        stats = db.get_detailed_stats()
        print(f"\n📈 Final Database Stats:")
        print(f"   Total Editions: {stats['editions']}")
        print(f"   Editions Sold: {stats['editions_sold']}")
        print(f"   Total Revenue: £{stats.get('total_revenue', 0):,.2f}")

        # Show import report summary
        report_summary = importer.import_report.get_summary()
        print(f"\n📋 Import Actions Summary:")
        print(f"   Print names standardized: {report_summary['print_names_standardized']}")
        print(f"   Distributor names standardized: {report_summary['distributor_names_standardized']}")
        print(f"   Sizes normalized: {report_summary['sizes_normalized']}")
        print(f"   Frame types normalized: {report_summary['frame_types_normalized']}")
        print(f"   Duplicate editions skipped: {report_summary['duplicates_skipped']}")
        if report_summary['editions_missing_print'] > 0:
            print(f"   Editions skipped (missing print): {report_summary['editions_missing_print']}")

        print(f"\n📄 Full report saved to: docs/user/import_assumptions.md")
        print(f"\n✅ SUCCESS! Database fully populated with {stats['editions']} editions")

        return 0

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())