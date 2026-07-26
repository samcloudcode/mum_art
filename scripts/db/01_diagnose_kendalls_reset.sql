-- ============================================================================
-- Kendalls stock-check reset: diagnosis (READ ONLY)
-- ============================================================================
--
--   uv run python scripts/db/run_sql.py scripts/db/01_diagnose_kendalls_reset.sql
--
-- Run this first and check the numbers. The restore is
-- 02_restore_kendalls_stock_check.sql.
--
-- WHAT HAPPENED
--   resetStockCheckForGallery() (web/src/lib/hooks/use-inventory.ts) issues one
--   bulk UPDATE setting BOTH is_stock_checked = false AND to_check_in_detail =
--   false for every printed, unsold edition at the gallery. Because that update
--   touches two fields at once, describeChanges() (web/src/lib/store/
--   inventory-store.ts:78-86) takes its multi-field branch and writes
--   activity_log rows with field_name / old_value / new_value all NULL. The
--   reset therefore did not record what it overwrote.
--
-- WHY RECOVERY IS STILL POSSIBLE
--   Individual ticks go through markStockChecked() / markNeedsReview(), which
--   update exactly ONE field, so those rows DO carry field_name, old_value,
--   new_value and created_at. Taking the most recent row that names the field
--   explicitly recovers the last deliberate intent per edition; the field-less
--   reset rows are ignored. An edition that was ticked and then deliberately
--   unticked correctly stays unticked.
--
-- LIMITS — read before trusting the numbers
--   * Only ticks made through the web app after 003_add_activity_log was
--     applied are recoverable.
--   * logActivity() is fire-and-forget (inventory-store.ts:419), so a tick
--     whose log insert failed cannot be recovered.
--   * If query 3 shows fewer editions than you remember checking, stop and use
--     Supabase PITR / daily backups instead — that is the only complete source.
--   * The reset does not necessarily cover the whole gallery.
--     resetStockCheckForGallery() filters the client's in-memory `allEditions`
--     (use-inventory.ts:210), so any edition the browser had not loaded escaped
--     it. On 2026-07-26 it logged 51 rows against 58 editions in stock, and
--     three editions ticked on 16 Jun were never cleared. Do not read
--     "editions_affected" in query 1 as the size of the gallery.
--   * `recoverable_checked` in query 3 is the last intent per edition across ALL
--     time, not one stock-check session. It can legitimately span several
--     sessions and look far larger than the check you just did. Before trusting
--     it, confirm no bulk reset landed between an edition's last tick and the
--     accident — otherwise that tick was already undone and restoring it
--     invents state. Verified clean for the 2026-07-26 reset.
-- ============================================================================


-- 1. The reset event(s): when, who, how many rows.
SELECT
    date_trunc('second', created_at) AS reset_at,
    user_email,
    count(*)                        AS editions_affected
FROM activity_log
WHERE entity_type = 'edition'
  AND field_name IS NULL
  AND description LIKE 'Updated 2 fields%'
  AND created_at > now() - interval '7 days'
GROUP BY 1, 2
ORDER BY reset_at DESC;


-- 2. Exactly what the restore would change.
WITH kendalls AS (
    SELECT id, name FROM distributors WHERE lower(name) LIKE 'kendall%'
),
last_check_intent AS (
    SELECT DISTINCT ON (entity_id) entity_id, new_value, created_at, user_email
    FROM activity_log
    WHERE entity_type = 'edition' AND field_name = 'is_stock_checked'
    ORDER BY entity_id, created_at DESC
),
last_review_intent AS (
    SELECT DISTINCT ON (entity_id) entity_id, new_value, created_at
    FROM activity_log
    WHERE entity_type = 'edition' AND field_name = 'to_check_in_detail'
    ORDER BY entity_id, created_at DESC
)
SELECT
    e.id,
    e.edition_display_name,
    k.name                   AS gallery,
    e.is_stock_checked       AS current_checked,
    (lci.new_value = 'true') AS restore_checked,
    (lri.new_value = 'true') AS restore_needs_review,
    lci.created_at           AS last_ticked_at,
    lci.user_email           AS last_ticked_by
FROM editions e
JOIN kendalls k                  ON k.id = e.distributor_id
LEFT JOIN last_check_intent  lci ON lci.entity_id = e.id
LEFT JOIN last_review_intent lri ON lri.entity_id = e.id
WHERE e.is_printed
  AND NOT e.is_sold
  AND (lci.new_value = 'true' OR lri.new_value = 'true')
ORDER BY e.edition_display_name;


-- 3. Summary. Compare recoverable_checked against what you actually checked.
WITH kendalls AS (
    SELECT id FROM distributors WHERE lower(name) LIKE 'kendall%'
),
last_check_intent AS (
    SELECT DISTINCT ON (entity_id) entity_id, new_value
    FROM activity_log
    WHERE entity_type = 'edition' AND field_name = 'is_stock_checked'
    ORDER BY entity_id, created_at DESC
)
SELECT
    count(*) FILTER (WHERE e.is_stock_checked)     AS currently_checked,
    count(*) FILTER (WHERE lci.new_value = 'true') AS recoverable_checked,
    count(*)                                       AS kendalls_in_stock
FROM editions e
JOIN kendalls k                 ON k.id = e.distributor_id
LEFT JOIN last_check_intent lci ON lci.entity_id = e.id
WHERE e.is_printed AND NOT e.is_sold;
