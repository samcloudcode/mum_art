#!/usr/bin/env python3
"""Fix distributor relationships using bulk updates."""

import os
import sys
import pandas as pd
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.manager import DatabaseManager
from db.models import Distributor, Edition
from cleaning.cleaner import AirtableDataCleaner
from sqlalchemy import text, update

def main():
    """Fix distributor relationships with bulk updates."""
    db = DatabaseManager()
    cleaner = AirtableDataCleaner()

    print("\n" + "="*80)
    print("FIXING DISTRIBUTOR RELATIONSHIPS (FAST VERSION)")
    print("="*80)

    # Load the source CSV
    csv_path = "airtable_export/Editions-All Records.csv"
    df = pd.read_csv(csv_path, encoding='utf-8-sig')

    # Filter valid editions
    valid_df = df[(df['Print - Edition'] != ' - ') & (df['Print - Edition'].notna())]
    # Only process rows with distributor data
    with_dist_df = valid_df[valid_df['Distributor'].notna()]

    print(f"Found {len(with_dist_df)} editions with distributor data")

    with db.get_session() as session:
        # Build distributor lookup
        distributors = {d.name: d.id for d in session.query(Distributor).all()}
        print(f"Found {len(distributors)} distributors in database")

        # Build updates dictionary: airtable_id -> distributor_id
        updates_map = {}
        missing_distributors = set()

        for idx, row in with_dist_df.iterrows():
            airtable_id = row.get('record_id')
            if not airtable_id:
                continue

            # Clean the distributor name
            distributor_name = cleaner.standardize_distributor_name(row['Distributor'])
            if not distributor_name:
                continue

            # Find distributor ID
            distributor_id = distributors.get(distributor_name)
            if not distributor_id:
                missing_distributors.add(distributor_name)
                continue

            updates_map[airtable_id] = distributor_id

        print(f"\nPrepared {len(updates_map)} updates")
        if missing_distributors:
            print(f"⚠️  {len(missing_distributors)} distributor names not found in DB:")
            for name in sorted(missing_distributors)[:10]:
                print(f"   • {name}")

        # Perform bulk update using raw SQL for speed
        if updates_map:
            print("\nApplying bulk updates...")

            # Build case statement for bulk update
            case_statements = []
            params = {}
            param_idx = 0

            for airtable_id, dist_id in updates_map.items():
                aid_param = f"aid_{param_idx}"
                did_param = f"did_{param_idx}"
                case_statements.append(f"WHEN airtable_id = :{aid_param} THEN :{did_param}")
                params[aid_param] = airtable_id
                params[did_param] = dist_id
                param_idx += 1

            # Build IN clause parameters
            in_clause_params = []
            for idx, aid in enumerate(updates_map.keys()):
                param_name = f"in_{idx}"
                in_clause_params.append(f":{param_name}")
                params[param_name] = aid

            sql = text(f"""
                UPDATE editions
                SET distributor_id = CASE
                    {' '.join(case_statements)}
                END
                WHERE airtable_id IN ({','.join(in_clause_params)})
                  AND distributor_id IS NULL
            """)

            result = session.execute(sql, params)
            updated_count = result.rowcount
            session.commit()

            print(f"✅ Successfully updated {updated_count} editions")

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

        # Check sold editions
        sold_editions = session.query(Edition).filter(
            Edition.is_sold == True,
            Edition.retail_price.isnot(None),
            Edition.retail_price > 0
        ).all()

        sold_with_dist = [e for e in sold_editions if e.distributor_id]
        sold_without_dist = [e for e in sold_editions if not e.distributor_id]

        print(f"\n💰 SOLD EDITIONS:")
        print(f"  With distributor: {len(sold_with_dist)} ({len(sold_with_dist)/len(sold_editions)*100:.1f}%)")
        print(f"  Without distributor: {len(sold_without_dist)} ({len(sold_without_dist)/len(sold_editions)*100:.1f}%)")

        # Calculate commission impact
        if sold_with_dist:
            revenue_with_dist = sum(e.retail_price for e in sold_with_dist)

            # Get commission data
            total_commission = 0
            for edition in sold_with_dist:
                if edition.distributor:
                    commission_pct = edition.distributor.commission_percentage or 0
                    total_commission += edition.retail_price * commission_pct / 100

            revenue_without_dist = sum(e.retail_price for e in sold_without_dist)
            total_revenue = revenue_with_dist + revenue_without_dist

            print(f"\n💵 FINANCIAL IMPACT:")
            print(f"  Total Revenue: £{total_revenue:,.2f}")
            print(f"  Revenue with distributor: £{revenue_with_dist:,.2f}")
            print(f"  Revenue without distributor: £{revenue_without_dist:,.2f}")
            print(f"  Total Commission (calculable): £{total_commission:,.2f}")
            print(f"  Net to Artist (calculable): £{revenue_with_dist - total_commission:,.2f}")

            # Estimate commission for editions without distributor
            avg_commission_rate = total_commission / revenue_with_dist * 100 if revenue_with_dist > 0 else 0
            estimated_commission_missing = revenue_without_dist * avg_commission_rate / 100

            print(f"\n📊 COMMISSION ESTIMATES:")
            print(f"  Average commission rate: {avg_commission_rate:.1f}%")
            print(f"  Estimated commission for missing distributors: £{estimated_commission_missing:,.2f}")
            print(f"  Total estimated commission: £{total_commission + estimated_commission_missing:,.2f}")
            print(f"  Total estimated net to artist: £{total_revenue - total_commission - estimated_commission_missing:,.2f}")

if __name__ == "__main__":
    main()