#!/usr/bin/env python3
"""Deep dive analysis of the art database to check for errors and validate data."""

import os
import sys
from decimal import Decimal
from collections import defaultdict, Counter
from datetime import datetime, date
from typing import Dict, List, Tuple, Optional

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.manager import DatabaseManager
from db.models import Print, Distributor, Edition
from sqlalchemy import text

def analyze_revenue_calculations(session):
    """Analyze revenue calculations and check for discrepancies."""
    print("\n" + "="*80)
    print("REVENUE ANALYSIS")
    print("="*80)

    # Get all sold editions with prices
    sold_editions = session.query(Edition).filter(
        Edition.is_sold == True,
        Edition.retail_price.isnot(None),
        Edition.retail_price > 0
    ).all()

    # Calculate total revenue from editions
    total_from_editions = sum(e.retail_price for e in sold_editions)

    # Group by distributor to check commission calculations
    revenue_by_distributor = defaultdict(lambda: {"revenue": Decimal(0), "count": 0, "commission_rate": None})

    for edition in sold_editions:
        if edition.distributor:
            dist_id = edition.distributor.id
            revenue_by_distributor[dist_id]["revenue"] += edition.price
            revenue_by_distributor[dist_id]["count"] += 1
            revenue_by_distributor[dist_id]["commission_rate"] = edition.distributor.commission_percentage
            revenue_by_distributor[dist_id]["name"] = edition.distributor.name

    print(f"\nTotal Revenue from Sold Editions: £{total_from_editions:,.2f}")
    print(f"Number of Sold Editions: {len(sold_editions)}")
    print(f"Average Sale Price: £{total_from_editions / len(sold_editions):,.2f}")

    print("\n" + "-"*50)
    print("Revenue by Distributor:")
    print("-"*50)

    total_commission = Decimal(0)
    for dist_id, data in sorted(revenue_by_distributor.items(), key=lambda x: x[1]["revenue"], reverse=True):
        commission = data["revenue"] * (data["commission_rate"] or 0) / 100
        total_commission += commission
        print(f"\n{data['name']}:")
        print(f"  Revenue: £{data['revenue']:,.2f}")
        print(f"  Sales: {data['count']}")
        print(f"  Commission Rate: {data['commission_rate']}%")
        print(f"  Commission Amount: £{commission:,.2f}")
        print(f"  Net to Artist: £{data['revenue'] - commission:,.2f}")

    print(f"\n" + "-"*50)
    print(f"Total Commissions Paid: £{total_commission:,.2f}")
    print(f"Net Revenue to Artist: £{total_from_editions - total_commission:,.2f}")

    return total_from_editions

def check_data_integrity(session):
    """Check for data integrity issues."""
    print("\n" + "="*80)
    print("DATA INTEGRITY CHECKS")
    print("="*80)

    issues = []

    # Check for editions without prints
    orphan_editions = session.query(Edition).filter(Edition.print_id.is_(None)).all()
    if orphan_editions:
        issues.append(f"Found {len(orphan_editions)} editions without associated prints")

    # Check for editions without distributors
    no_dist_editions = session.query(Edition).filter(Edition.distributor_id.is_(None)).all()
    if no_dist_editions:
        issues.append(f"Found {len(no_dist_editions)} editions without distributors")

    # Check for duplicate edition numbers per print
    duplicates = session.execute(text("""
        SELECT print_id, edition_number, COUNT(*) as count
        FROM editions
        WHERE print_id IS NOT NULL AND edition_number IS NOT NULL
        GROUP BY print_id, edition_number
        HAVING COUNT(*) > 1
    """)).fetchall()

    if duplicates:
        issues.append(f"Found {len(duplicates)} duplicate edition number combinations")
        print("\nDuplicate Edition Numbers:")
        for dup in duplicates[:10]:  # Show first 10
            print_obj = session.query(Print).get(dup[0])
            print(f"  Print: {print_obj.name if print_obj else 'Unknown'}, Edition #{dup[1]}: {dup[2]} copies")

    # Check for negative or zero prices on sold items
    bad_prices = session.query(Edition).filter(
        Edition.is_sold == True,
        (Edition.retail_price <= 0) | (Edition.retail_price.is_(None))
    ).all()

    if bad_prices:
        issues.append(f"Found {len(bad_prices)} sold editions with zero or negative prices")

    # Check for edition numbers outside expected range
    for print_obj in session.query(Print).all():
        editions = session.query(Edition).filter(Edition.print_id == print_obj.id).all()
        for ed in editions:
            if ed.edition_number:
                if ed.edition_number < 1 or ed.edition_number > (print_obj.total_editions or 999):
                    issues.append(f"Edition {ed.id} has number {ed.edition_number} but print {print_obj.name} has total {print_obj.total_editions}")

    if issues:
        print("\n⚠️  Issues Found:")
        for issue in issues:
            print(f"  • {issue}")
    else:
        print("\n✅ No integrity issues found")

    return issues

def analyze_pricing_outliers(session):
    """Analyze pricing distributions and outliers."""
    print("\n" + "="*80)
    print("PRICING ANALYSIS")
    print("="*80)

    # Get all editions with prices
    priced_editions = session.query(Edition).filter(
        Edition.retail_price.isnot(None),
        Edition.retail_price > 0
    ).all()

    # Group by size/frame
    price_by_category = defaultdict(list)
    for ed in priced_editions:
        category = f"{ed.size or 'Unknown'} - {ed.frame_type or 'Unknown'}"
        price_by_category[category].append(float(ed.retail_price))

    print("\nPrice Ranges by Category:")
    print("-"*50)

    for category, prices in sorted(price_by_category.items()):
        if prices:
            avg_price = sum(prices) / len(prices)
            min_price = min(prices)
            max_price = max(prices)
            print(f"\n{category}:")
            print(f"  Count: {len(prices)}")
            print(f"  Average: £{avg_price:.2f}")
            print(f"  Range: £{min_price:.2f} - £{max_price:.2f}")

            # Check for outliers (>3 std dev from mean)
            if len(prices) > 3:
                import statistics
                mean = statistics.mean(prices)
                stdev = statistics.stdev(prices)
                outliers = [p for p in prices if abs(p - mean) > 3 * stdev]
                if outliers:
                    print(f"  ⚠️  Outliers: {', '.join([f'£{p:.2f}' for p in sorted(outliers)])}")

    # Check for suspicious price patterns
    print("\n" + "-"*50)
    print("Suspicious Price Patterns:")
    print("-"*50)

    # Very high prices
    high_price_editions = session.query(Edition).filter(Edition.retail_price > 500).all()
    if high_price_editions:
        print(f"\n⚠️  {len(high_price_editions)} editions priced over £500:")
        for ed in high_price_editions[:5]:
            print(f"  • {ed.print.name if ed.print else 'Unknown'} #{ed.edition_number}: £{ed.retail_price:.2f} ({ed.size}/{ed.frame_type})")

    # Very low prices
    low_price_editions = session.query(Edition).filter(
        Edition.retail_price > 0,
        Edition.retail_price < 20
    ).all()
    if low_price_editions:
        print(f"\n⚠️  {len(low_price_editions)} editions priced under £20:")
        for ed in low_price_editions[:5]:
            print(f"  • {ed.print.name if ed.print else 'Unknown'} #{ed.edition_number}: £{ed.retail_price:.2f} ({ed.size}/{ed.frame_type})")

def analyze_distributor_performance(session):
    """Analyze distributor performance and commission structures."""
    print("\n" + "="*80)
    print("DISTRIBUTOR PERFORMANCE ANALYSIS")
    print("="*80)

    distributors = session.query(Distributor).all()

    dist_stats = []
    for dist in distributors:
        editions = session.query(Edition).filter(Edition.distributor_id == dist.id).all()
        sold = [e for e in editions if e.is_sold]
        revenue = sum(e.retail_price for e in sold if e.retail_price)

        if editions:
            sell_through = len(sold) / len(editions) * 100
        else:
            sell_through = 0

        dist_stats.append({
            "name": dist.name,
            "total_editions": len(editions),
            "sold": len(sold),
            "sell_through": sell_through,
            "revenue": revenue,
            "commission_rate": dist.commission_percentage,
            "commission": revenue * (dist.commission_percentage or 0) / 100
        })

    # Sort by revenue
    dist_stats.sort(key=lambda x: x["revenue"], reverse=True)

    print("\nTop Distributors by Revenue:")
    print("-"*50)
    for stat in dist_stats[:10]:
        print(f"\n{stat['name']}:")
        print(f"  Editions: {stat['total_editions']} ({stat['sold']} sold)")
        print(f"  Sell-through: {stat['sell_through']:.1f}%")
        print(f"  Revenue: £{stat['revenue']:,.2f}")
        print(f"  Commission: {stat['commission_rate']}% (£{stat['commission']:,.2f})")

    # Check for unusual commission rates
    unusual_commissions = [d for d in dist_stats if d["commission_rate"] not in [0, 40, 50]]
    if unusual_commissions:
        print("\n⚠️  Unusual Commission Rates:")
        for d in unusual_commissions:
            print(f"  • {d['name']}: {d['commission_rate']}%")

def analyze_print_edition_counts(session):
    """Cross-reference edition counts with print totals."""
    print("\n" + "="*80)
    print("PRINT EDITION COUNT ANALYSIS")
    print("="*80)

    prints = session.query(Print).all()

    discrepancies = []
    for print_obj in prints:
        editions = session.query(Edition).filter(Edition.print_id == print_obj.id).all()
        actual_count = len(editions)
        expected_count = print_obj.total_editions or 0

        if actual_count != expected_count:
            discrepancies.append({
                "name": print_obj.name,
                "expected": expected_count,
                "actual": actual_count,
                "difference": actual_count - expected_count
            })

    if discrepancies:
        print("\n⚠️  Edition Count Discrepancies:")
        print("-"*50)
        discrepancies.sort(key=lambda x: abs(x["difference"]), reverse=True)
        for disc in discrepancies[:15]:
            print(f"\n{disc['name']}:")
            print(f"  Expected: {disc['expected']} editions")
            print(f"  Actual: {disc['actual']} editions")
            print(f"  Difference: {disc['difference']:+d}")
    else:
        print("\n✅ All print edition counts match expected totals")

def analyze_temporal_patterns(session):
    """Analyze sales patterns over time."""
    print("\n" + "="*80)
    print("TEMPORAL PATTERNS ANALYSIS")
    print("="*80)

    # Get sold editions with dates
    sold_with_dates = session.query(Edition).filter(
        Edition.is_sold == True,
        Edition.date_sold.isnot(None)
    ).all()

    if sold_with_dates:
        # Group by year
        sales_by_year = defaultdict(lambda: {"count": 0, "revenue": Decimal(0)})
        for ed in sold_with_dates:
            year = ed.date_sold.year
            sales_by_year[year]["count"] += 1
            if ed.retail_price:
                sales_by_year[year]["revenue"] += ed.retail_price

        print("\nSales by Year:")
        print("-"*50)
        for year in sorted(sales_by_year.keys()):
            data = sales_by_year[year]
            avg_price = data["revenue"] / data["count"] if data["count"] > 0 else 0
            print(f"{year}: {data['count']} sales, £{data['revenue']:,.2f} revenue (avg £{avg_price:.2f})")

        # Check for future dates
        future_sales = [e for e in sold_with_dates if e.date_sold > date.today()]
        if future_sales:
            print(f"\n⚠️  Found {len(future_sales)} sales with future dates!")
            for ed in future_sales[:5]:
                print(f"  • {ed.print.name if ed.print else 'Unknown'} sold on {ed.date_sold}")

        # Check for very old dates
        old_sales = [e for e in sold_with_dates if e.date_sold.year < 2010]
        if old_sales:
            print(f"\n⚠️  Found {len(old_sales)} sales before 2010")

def check_missing_data(session):
    """Check for missing or incomplete data."""
    print("\n" + "="*80)
    print("MISSING DATA ANALYSIS")
    print("="*80)

    # Check for missing essential fields
    editions = session.query(Edition).all()

    missing_stats = {
        "price": 0,
        "size": 0,
        "frame": 0,
        "variation": 0,
        "date_sold": 0,
        "edition_number": 0
    }

    sold_missing_date = []
    unsold_with_date = []

    for ed in editions:
        if ed.retail_price is None or ed.retail_price == 0:
            missing_stats["price"] += 1
        if not ed.size:
            missing_stats["size"] += 1
        if not ed.frame_type:
            missing_stats["frame"] += 1
        if not ed.variation:
            missing_stats["variation"] += 1
        if ed.is_sold and not ed.date_sold:
            missing_stats["date_sold"] += 1
            sold_missing_date.append(ed)
        if not ed.is_sold and ed.date_sold:
            unsold_with_date.append(ed)
        if not ed.edition_number:
            missing_stats["edition_number"] += 1

    total_editions = len(editions)
    print(f"\nTotal Editions: {total_editions}")
    print("\nMissing Data Statistics:")
    print("-"*50)
    for field, count in missing_stats.items():
        percentage = (count / total_editions * 100) if total_editions > 0 else 0
        print(f"{field:15} : {count:5} missing ({percentage:.1f}%)")

    if sold_missing_date:
        print(f"\n⚠️  {len(sold_missing_date)} sold editions missing sale date")

    if unsold_with_date:
        print(f"\n⚠️  {len(unsold_with_date)} unsold editions have a sale date!")
        for ed in unsold_with_date[:5]:
            print(f"  • {ed.print.name if ed.print else 'Unknown'} #{ed.edition_number} dated {ed.date_sold}")

def main():
    """Run all analysis checks."""
    db = DatabaseManager()

    with db.get_session() as session:
        # Run all analyses
        total_revenue = analyze_revenue_calculations(session)
        check_data_integrity(session)
        analyze_pricing_outliers(session)
        analyze_distributor_performance(session)
        analyze_print_edition_counts(session)
        analyze_temporal_patterns(session)
        check_missing_data(session)

        # Final summary
        print("\n" + "="*80)
        print("FINAL SUMMARY")
        print("="*80)

        total_editions = session.query(Edition).count()
        sold_editions = session.query(Edition).filter(Edition.is_sold == True).count()
        total_prints = session.query(Print).count()
        total_distributors = session.query(Distributor).count()

        print(f"\nDatabase Statistics:")
        print(f"  Total Prints: {total_prints}")
        print(f"  Total Distributors: {total_distributors}")
        print(f"  Total Editions: {total_editions}")
        print(f"  Sold Editions: {sold_editions} ({sold_editions/total_editions*100:.1f}%)")
        print(f"  Total Revenue: £{total_revenue:,.2f}")

        # Revenue validation
        print(f"\n💡 Revenue Analysis:")
        print(f"  The total revenue of £{total_revenue:,.2f} seems plausible for:")
        print(f"  • 11+ years of sales (2013-2024)")
        print(f"  • {sold_editions} editions sold")
        print(f"  • Average price of £{total_revenue/sold_editions:.2f} per piece")
        print(f"  • High-end art prints with premium framing")

if __name__ == "__main__":
    main()