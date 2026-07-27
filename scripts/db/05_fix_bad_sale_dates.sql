-- ============================================================================
-- Correct the two out-of-range date_sold values (WRITES)
-- ============================================================================
--
-- Dry run first — this prints what it would change and rolls back:
--   uv run python scripts/db/run_sql.py scripts/db/05_fix_bad_sale_dates.sql
--
-- Then apply:
--   uv run python scripts/db/run_sql.py scripts/db/05_fix_bad_sale_dates.sql --commit
--
-- Run 03_find_bad_sale_dates.sql first to confirm these are still the only two
-- bad rows.
--
-- WHAT HAPPENED
--   Two editions were saved with a mistyped year — an extra digit inserted into
--   an otherwise correct date. Postgres DATE accepts a five-digit year happily,
--   so nothing rejected them at write time:
--
--     110913  Regatta - 161   20255-04-10  ->  2025-04-10
--     105298  B. SVYCM - 4    20203-03-09  ->  2023-03-09
--
--   110913 was the row behind the dashboard's "-6657898 days ago" Last Sale.
--
-- WHERE THE REPLACEMENT DATES COME FROM — these are a human judgement, NOT
-- something recovered from the log. Sam chose them on 2026-07-26; the evidence
-- that supports them is:
--   * 110913 has NO field-level activity_log row for date_sold at all. It was
--     set via "Marked as sold", which writes several fields at once and so logs
--     no old_value/new_value. Nothing records the intended date. 2025-04-10
--     reads the typo as one inserted digit, and April 2025 sits between the
--     2022-08-08 gallery date and the 2026-01-18 settle-up.
--   * 105298 does have a log row (suestitt, 2026-01-15) but its old_value is
--     empty — the typo was the first value ever written, so there is nothing to
--     revert to. 2023-03-09 reads 20203 as 2023, and the edition entered the
--     gallery on 2023-03-01, making a sale eight days later plausible.
--   Neither date is recoverable from the log. If either is wrong, it is wrong
--   because the judgement was wrong, not because this script misapplied it.
--
-- SAFETY
--   Each UPDATE is guarded on the id AND on the date still being out of range,
--   so it cannot overwrite an already-corrected value and a second run is a
--   no-op (0 rows). If a guard matches 0 rows, someone has already fixed it —
--   check before assuming the script failed.
--
-- No BEGIN/COMMIT here on purpose — run_sql.py owns the transaction so the dry
-- run cannot be defeated by a stray COMMIT.
-- ============================================================================


-- 1. Regatta - 161 (Seaview Regatta, Seaview Gallery): 20255-04-10 -> 2025-04-10
UPDATE editions
SET date_sold = DATE '2025-04-10'
WHERE id = 110913
  AND date_sold > current_date
RETURNING id, edition_display_name, date_sold::text AS date_sold_now;


-- 2. B. SVYCM - 4 (B Seaview Yacht Club Mermaids, Direct): 20203-03-09 -> 2023-03-09
UPDATE editions
SET date_sold = DATE '2023-03-09'
WHERE id = 105298
  AND date_sold > current_date
RETURNING id, edition_display_name, date_sold::text AS date_sold_now;


-- 3. Confirm nothing out of range is left. Expect (0 rows).
SELECT id, edition_display_name, date_sold::text AS date_sold
FROM editions
WHERE date_sold       > current_date OR date_sold       < DATE '1970-01-01'
   OR date_in_gallery > current_date OR date_in_gallery < DATE '1970-01-01';
