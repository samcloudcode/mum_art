# Issue: Date inputs lack enforceable range validation

## Status
Open - data quality / input validation

## Description
The database accepts dates outside any plausible inventory range, including
five-digit years. Several UI paths also pass date values through without an
enforced application-level check. Two editions were saved with a mistyped year
and went unnoticed for six months:

| id | edition | stored date_sold | intended |
|---|---|---|---|
| 110913 | Regatta - 161 | 20255-04-10 | 2025-04-10 |
| 105298 | B. SVYCM - 4 | 20203-03-09 | 2023-03-09 |

Both rows were corrected on 2026-07-27 by `scripts/db/05_fix_bad_sale_dates.sql`,
but nothing stops the same typo being entered again.

## Impact
- `110913` hijacked the dashboard "Last Sale" stat, which rendered
  "-6657898 days ago" — roughly 18,200 years in the future.
- Bad dates sort to the top of any `ORDER BY date_sold DESC`, so a single row
  can dominate a report.
- psycopg2 cannot represent a year above 9999, so a plain `SELECT date_sold`
  raises `year 20255 is out of range` and aborts the transaction. Any script
  touching such a row fails on exactly the row it needs to find, unless the
  column is cast with `::text`.

## What is already handled
- The dashboard discards future and unparseable dates before picking the most
  recent sale (`web/src/app/(dashboard)/page.tsx`), so the stat no longer
  breaks — but the underlying row still renders as e.g. "10 Apr 20255" in the
  editions table.
- The primary sale-status and inline date inputs have native `min` and `max`
  attributes. Other date inputs do not, and HTML attributes are not validation
  for writes from other UI paths, imports, scripts, or direct database access.
- `scripts/db/03_find_bad_sale_dates.sql` finds any out-of-range rows.

## Possible Solutions
1. **Client-side bound** on the date inputs — reject anything outside, say,
   1970..today+1y at the point of entry. Cheapest, catches the typo where it
   happens.
2. **Database CHECK constraint** on `editions.date_sold` and
   `date_in_gallery`. Strongest guarantee, catches every write path including
   imports and scripts, but needs the existing rows to be clean first.
3. **Both** — constraint as the backstop, client bound for the error message.

## Recommendation
Option 3. The constraint is what actually guarantees it; the client bound is
what makes the failure legible to the person typing.
