#!/usr/bin/env python
"""Smart import script with duplicate handling."""

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

        # Get final stats
        stats = db.get_detailed_stats()
        print(f"\n📈 Final Database Stats:")
        print(f"   Total Editions: {stats['editions']}")
        print(f"   Editions Sold: {stats['editions_sold']}")
        print(f"   Total Revenue: £{stats.get('total_revenue', 0):,.2f}")

        # Run validation
        print(f"\n🔍 Running validation...")
        from validation.validator import DataValidator
        validator = DataValidator(db)
        val_results = validator.validate()

        if val_results['errors']:
            print(f"❌ Validation errors: {val_results['errors']}")
        if val_results['warnings']:
            print(f"⚠️ Validation warnings: {val_results['warnings']}")

        if not val_results['errors']:
            print(f"\n✅ SUCCESS! Database fully populated with {stats['editions']} editions")

        return 0

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())