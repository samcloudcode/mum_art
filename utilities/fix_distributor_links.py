#!/usr/bin/env python3
"""Fix distributor relationships by re-linking editions to distributors."""

import os
import sys
import pandas as pd
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.manager import DatabaseManager
from db.models import Distributor, Edition
from cleaning.cleaner import AirtableDataCleaner
from sqlalchemy import text

def main():
    """Fix distributor relationships."""
    db = DatabaseManager()
    cleaner = AirtableDataCleaner()

    print("\n" + "="*80)
    print("FIXING DISTRIBUTOR RELATIONSHIPS")
    print("="*80)

    # Load the source CSV
    csv_path = "airtable_export/Editions-All Records.csv"
    df = pd.read_csv(csv_path, encoding='utf-8-sig')

    # Filter valid editions (same as during import)
    valid_df = df[(df['Print - Edition'] != ' - ') & (df['Print - Edition'].notna())]
    print(f"Processing {len(valid_df)} valid editions")

    with db.get_session() as session:
        # Build distributor lookup
        distributors = {d.name: d.id for d in session.query(Distributor).all()}
        print(f"Found {len(distributors)} distributors in database")

        # Get all editions with their airtable_ids for matching
        editions_dict = {}
        for edition in session.query(Edition).all():
            if edition.airtable_id:
                editions_dict[edition.airtable_id] = edition

        print(f"Found {len(editions_dict)} editions in database")

        # Track statistics
        stats = {
            'updated': 0,
            'no_distributor_in_csv': 0,
            'distributor_not_found': 0,
            'edition_not_found': 0,
            'already_linked': 0
        }

        # Process each row
        for idx, row in valid_df.iterrows():
            # Get airtable_id for this edition
            airtable_id = row.get('record_id')
            if not airtable_id:
                continue

            # Find the edition in database
            edition = editions_dict.get(airtable_id)
            if not edition:
                stats['edition_not_found'] += 1
                continue

            # Check if already has distributor
            if edition.distributor_id:
                stats['already_linked'] += 1
                continue

            # Get distributor from CSV
            distributor_raw = row.get('Distributor')
            if pd.isna(distributor_raw) or not distributor_raw:
                stats['no_distributor_in_csv'] += 1
                continue

            # Clean the distributor name
            distributor_name = cleaner.standardize_distributor_name(distributor_raw)
            if not distributor_name:
                stats['no_distributor_in_csv'] += 1
                continue

            # Find distributor ID
            distributor_id = distributors.get(distributor_name)
            if not distributor_id:
                print(f"  ⚠️  Distributor not found: '{distributor_name}' (raw: '{distributor_raw}')")
                stats['distributor_not_found'] += 1
                continue

            # Update the edition
            edition.distributor_id = distributor_id
            stats['updated'] += 1

            # Show progress every 500 updates
            if stats['updated'] % 500 == 0:
                print(f"  Progress: {stats['updated']} editions updated...")

        # Commit all changes
        session.commit()

        print("\n" + "="*80)
        print("RESULTS")
        print("="*80)
        print(f"✅ Successfully updated: {stats['updated']} editions")
        print(f"⚠️  No distributor in CSV: {stats['no_distributor_in_csv']} editions")
        print(f"❌ Distributor not found in DB: {stats['distributor_not_found']} editions")
        print(f"❌ Edition not found in DB: {stats['edition_not_found']} editions")
        print(f"ℹ️  Already had distributor: {stats['already_linked']} editions")

        # Verify the fix
        print("\n" + "="*80)
        print("VERIFICATION")
        print("="*80)

        total_editions = session.query(Edition).count()
        with_distributor = session.query(Edition).filter(Edition.distributor_id.isnot(None)).count()
        without_distributor = session.query(Edition).filter(Edition.distributor_id.is_(None)).count()

        print(f"Total editions: {total_editions}")
        print(f"With distributor: {with_distributor} ({with_distributor/total_editions*100:.1f}%)")
        print(f"Without distributor: {without_distributor} ({without_distributor/total_editions*100:.1f}%)")

        # Check sold editions specifically
        sold_with_dist = session.query(Edition).filter(
            Edition.is_sold == True,
            Edition.distributor_id.isnot(None)
        ).count()
        sold_without_dist = session.query(Edition).filter(
            Edition.is_sold == True,
            Edition.distributor_id.is_(None)
        ).count()

        print(f"\nSold editions:")
        print(f"  With distributor: {sold_with_dist}")
        print(f"  Without distributor: {sold_without_dist}")

        # Calculate commission impact
        if sold_with_dist > 0:
            # Sample calculation of commissions
            sold_with_dist_editions = session.query(Edition).filter(
                Edition.is_sold == True,
                Edition.distributor_id.isnot(None),
                Edition.retail_price.isnot(None)
            ).all()

            total_revenue = sum(e.retail_price for e in sold_with_dist_editions if e.retail_price)
            total_commission = sum(
                e.retail_price * (e.distributor.commission_percentage or 0) / 100
                for e in sold_with_dist_editions
                if e.retail_price and e.distributor
            )

            print(f"\n💰 Commission Impact (for editions with distributors):")
            print(f"  Revenue: £{total_revenue:,.2f}")
            print(f"  Commission: £{total_commission:,.2f}")
            print(f"  Net to artist: £{total_revenue - total_commission:,.2f}")

if __name__ == "__main__":
    main()