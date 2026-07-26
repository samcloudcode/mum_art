-- ============================================================================
-- Kendalls stock-check reset: restore (WRITES)
-- ============================================================================
--
-- Dry run first — this prints what it would change and rolls back:
--   uv run python scripts/db/run_sql.py scripts/db/02_restore_kendalls_stock_check.sql
--
-- Then apply:
--   uv run python scripts/db/run_sql.py scripts/db/02_restore_kendalls_stock_check.sql --commit
--
-- Run 01_diagnose_kendalls_reset.sql first and check its query 3 summary
-- against what you actually stock-checked. See that file for how this
-- reconstructs the pre-reset state and what it cannot recover.
--
-- The restore is additive: it only ever turns flags ON, never off, so running
-- it twice is harmless and it cannot clear a tick made since the reset.
--
-- No BEGIN/COMMIT here on purpose — run_sql.py owns the transaction so the
-- dry run cannot be defeated by a stray COMMIT.
-- ============================================================================

WITH kendalls AS (
    SELECT id FROM distributors WHERE lower(name) LIKE 'kendall%'
),
last_check_intent AS (
    SELECT DISTINCT ON (entity_id) entity_id, new_value
    FROM activity_log
    WHERE entity_type = 'edition' AND field_name = 'is_stock_checked'
    ORDER BY entity_id, created_at DESC
),
last_review_intent AS (
    SELECT DISTINCT ON (entity_id) entity_id, new_value
    FROM activity_log
    WHERE entity_type = 'edition' AND field_name = 'to_check_in_detail'
    ORDER BY entity_id, created_at DESC
),
targets AS (
    SELECT
        e.id,
        coalesce(lci.new_value = 'true', false) AS want_checked,
        coalesce(lri.new_value = 'true', false) AS want_review
    FROM editions e
    JOIN kendalls k                  ON k.id = e.distributor_id
    LEFT JOIN last_check_intent  lci ON lci.entity_id = e.id
    LEFT JOIN last_review_intent lri ON lri.entity_id = e.id
    WHERE e.is_printed
      AND NOT e.is_sold
      AND (lci.new_value = 'true' OR lri.new_value = 'true')
)
UPDATE editions e
SET is_stock_checked   = t.want_checked OR e.is_stock_checked,
    to_check_in_detail = t.want_review  OR e.to_check_in_detail
FROM targets t
WHERE e.id = t.id
RETURNING e.id, e.edition_display_name, e.is_stock_checked, e.to_check_in_detail;
