# Issue: 135 Sales Missing date_sold

## Status
Open - data quality issue

## Description
135 out of 3,664 sold editions have `date_sold = NULL`. This affects time-based reporting accuracy.

## Impact
- YTD, last year, last 30 days stats undercount by up to 135 sales
- These sales show as sold but don't appear in time-period breakdowns
- ~3.7% of sales affected

## Query to Find Affected Records
```sql
SELECT
  e.id,
  e.edition_display_name,
  p.name as print_name,
  d.name as distributor_name,
  e.retail_price,
  e.is_settled
FROM editions e
JOIN prints p ON p.id = e.print_id
LEFT JOIN distributors d ON d.id = e.distributor_id
WHERE e.is_sold = true AND e.date_sold IS NULL
ORDER BY e.id;
```

## Possible Solutions
1. **Manual fix**: Review and backfill dates from records/memory
2. **Default date**: Set a placeholder date (e.g., "2020-01-01") for old sales
3. **Accept as-is**: Document that time-based stats exclude legacy sales without dates

## Recommendation
Option 1 if feasible, otherwise Option 3 with clear UI indication that time-based stats only include sales with recorded dates.
