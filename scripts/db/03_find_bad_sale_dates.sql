-- ============================================================================
-- Find editions with an out-of-range date_sold / date_in_gallery (READ ONLY)
-- ============================================================================
--
--   uv run python scripts/db/run_sql.py scripts/db/03_find_bad_sale_dates.sql
--
-- The dashboard "Last Sale" stat showed "-6657898 days ago", which is roughly
-- 18,200 years in the future — the signature of a mistyped year (e.g. 20256
-- entered instead of 2025). Postgres DATE accepts it happily, and the old
-- dashboard code had no lower bound on its "days ago" ladder, so the single bad
-- row won the sort and hijacked the stat.
--
-- Run with: uv run python scripts/db/run_sql.py scripts/db/03_find_bad_sale_dates.sql
--
-- The display side is fixed in web/src/app/(dashboard)/page.tsx (future and
-- unparseable dates are now discarded before picking the most recent sale), but
-- the underlying row is still wrong and will still render as e.g. "12 Aug 20256"
-- in the editions table. Use this to find and correct it.
-- ============================================================================

-- 1. Anything dated in the future or implausibly far in the past.
SELECT
    e.id,
    e.edition_display_name,
    p.name        AS artwork,
    d.name        AS location,
    e.is_sold,
    e.date_sold,
    e.date_in_gallery,
    e.updated_at
FROM editions e
LEFT JOIN prints       p ON p.id = e.print_id
LEFT JOIN distributors d ON d.id = e.distributor_id
WHERE e.date_sold       > current_date
   OR e.date_sold       < DATE '1970-01-01'
   OR e.date_in_gallery > current_date
   OR e.date_in_gallery < DATE '1970-01-01'
ORDER BY e.date_sold DESC NULLS LAST;


-- 2. Who last touched those rows, per activity_log, to help work out the
--    intended date before correcting it.
WITH bad AS (
    SELECT id FROM editions
    WHERE date_sold       > current_date OR date_sold       < DATE '1970-01-01'
       OR date_in_gallery > current_date OR date_in_gallery < DATE '1970-01-01'
)
SELECT
    al.entity_id,
    al.entity_name,
    al.field_name,
    al.old_value,
    al.new_value,
    al.user_email,
    al.created_at
FROM activity_log al
JOIN bad b ON b.id = al.entity_id
WHERE al.entity_type = 'edition'
ORDER BY al.entity_id, al.created_at DESC;


-- 3. Correct a row once you know the intended date. Edit both values first.
--    Left commented out deliberately — do not run blind.
--
-- UPDATE editions
-- SET date_sold = DATE '2025-08-12'   -- <- the intended date
-- WHERE id = 0;                        -- <- the edition id from query 1
