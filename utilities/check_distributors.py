#!/usr/bin/env python3
"""Check distributor data and relationships."""

import os
import sys
import pandas as pd
from collections import defaultdict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.manager import DatabaseManager
from db.models import Print, Distributor, Edition
from cleaning.cleaner import AirtableDataCleaner

def main():
    """Check distributor data."""
    db = DatabaseManager()
    cleaner = AirtableDataCleaner()

    with db.get_session() as session:
        print("\n" + "="*80)
        print("DISTRIBUTOR DATA CHECK")
        print("="*80)

        # Check existing distributors
        distributors = session.query(Distributor).all()
        print(f"\n✅ Found {len(distributors)} distributors in database:")
        for dist in distributors:
            print(f"  • {dist.name} (ID: {dist.id}, Commission: {dist.commission_percentage}%)")

        # Check editions CSV for distributor data
        print("\n" + "="*80)
        print("CHECKING SOURCE CSV FOR DISTRIBUTOR DATA")
        print("="*80)

        csv_path = "airtable_export/Editions-All Records.csv"
        df = pd.read_csv(csv_path, encoding='utf-8-sig')

        # Check distributor column
        print(f"\nTotal rows in CSV: {len(df)}")

        # Get unique distributor values
        dist_values = df['Distributor'].dropna().unique()
        print(f"\nUnique distributor values in CSV: {len(dist_values)}")
        for dist in sorted(dist_values)[:20]:  # Show first 20
            count = len(df[df['Distributor'] == dist])
            print(f"  • {dist}: {count} editions")

        # Check how many editions have distributor data
        has_dist = df['Distributor'].notna().sum()
        no_dist = df['Distributor'].isna().sum()
        print(f"\n📊 Distributor data in CSV:")
        print(f"  • Editions WITH distributor: {has_dist} ({has_dist/len(df)*100:.1f}%)")
        print(f"  • Editions WITHOUT distributor: {no_dist} ({no_dist/len(df)*100:.1f}%)")

        # Test the cleaner on a sample row
        print("\n" + "="*80)
        print("TESTING CLEANER ON SAMPLE ROWS")
        print("="*80)

        # Find a row with distributor data
        sample_df = df[df['Distributor'].notna()].head(3)
        for idx, row in sample_df.iterrows():
            print(f"\nRow {idx}:")
            print(f"  Original Distributor: {row['Distributor']}")
            cleaned = cleaner.clean_edition_data(row.to_dict())
            print(f"  Cleaned distributor_name: {cleaned.get('distributor_name')}")

            # Check if this distributor exists in DB
            if cleaned.get('distributor_name'):
                dist_in_db = session.query(Distributor).filter(
                    Distributor.name == cleaned['distributor_name']
                ).first()
                if dist_in_db:
                    print(f"  ✅ Found in DB with ID: {dist_in_db.id}")
                else:
                    print(f"  ❌ NOT found in database!")

        # Check distributor name mapping
        print("\n" + "="*80)
        print("DISTRIBUTOR NAME MAPPING ISSUES")
        print("="*80)

        db_dist_names = {d.name for d in distributors}
        csv_dist_names = set()

        for dist_value in dist_values:
            if dist_value:
                cleaned_name = cleaner.standardize_distributor_name(dist_value)
                if cleaned_name:
                    csv_dist_names.add(cleaned_name)

        print(f"\nDistributors in DB: {len(db_dist_names)}")
        print(f"Distributors in CSV (cleaned): {len(csv_dist_names)}")

        missing_in_db = csv_dist_names - db_dist_names
        if missing_in_db:
            print(f"\n❌ Distributors in CSV but NOT in database ({len(missing_in_db)}):")
            for name in sorted(missing_in_db)[:20]:
                print(f"  • {name}")

        extra_in_db = db_dist_names - csv_dist_names
        if extra_in_db:
            print(f"\n⚠️  Distributors in database but NOT in CSV ({len(extra_in_db)}):")
            for name in sorted(extra_in_db):
                print(f"  • {name}")

if __name__ == "__main__":
    main()