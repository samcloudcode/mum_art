-- ============================================================================
-- Recovery: undo the Kendalls stock-check reset
-- ============================================================================
--
-- WHAT HAPPENED
--   resetStockCheckForGallery() (web/src/lib/hooks/use-inventory.ts) issues a
--   single bulk UPDATE setting BOTH is_stock_checked = false AND
--   to_check_in_detail = false for every printed, unsold edition at the
--   gallery. Because that update touches two fields at once, describeChanges()
--   (web/src/lib/store/inventory-store.ts:78-86) takes its multi-field branch
--   and writes activity_log rows with field_name / old_value / new_value all
--   NULL. So the reset itself did NOT record what it overwrote.
--
-- WHY RECOVERY IS STILL POSSIBLE
--   Individual ticks go through markStockChecked() / markNeedsReview(), which
--   update exactly ONE field. Those log rows DO carry
--   field_name = 'is_stock_checked', old_value, new_value and created_at.
--   So the last deliberate per-edition intent is recoverable from the log,
--   and the reset rows (field_name IS NULL) are simply ignored.
--
-- METHOD
--   For each Kendalls edition, take the most recent activity_log row that
--   names the field explicitly. If that last intent was 'true', the edition
--   was checked when the reset wiped it, and we restore it.
--
-- LIMITS — read before trusting the numbers
--   * Only ticks made through the web app after migration 003_add_activity_log
--     was applied are recoverable. Anything older is invisible here.
--   * logActivity() is fire-and-forget (inventory-store.ts:419), so a tick
--     whose log insert failed cannot be recovered.
--   * If PART A shows fewer editions than you remember checking, stop and use
--     Supabase PITR / daily backups instead — that is the only complete source.
--
-- HOW TO RUN
--   PART A is read-only. Run it first and sanity-check the counts against what
--   you actually checked. Only then run PART B, which is wrapped in an explicit
--   transaction so you can ROLLBACK if the preview looks wrong.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- PART A — diagnose (READ ONLY, safe to run any time)
-- ---------------------------------------------------------------------------

-- A1. Confirm the reset event: when it ran, who ran it, how many rows it hit.
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


-- A2. Preview exactly what PART B would restore.
WITH kendalls AS (
    SELECT id, name
    FROM distributors
    WHERE lower(name) LIKE 'kendall%'
),
-- Most recent explicit per-field intent, ignoring the field-less reset rows.
last_check_intent AS (
    SELECT DISTINCT ON (entity_id)
        entity_id, new_value, created_at, user_email
    FROM activity_log
    WHERE entity_type = 'edition'
      AND field_name  = 'is_stock_checked'
    ORDER BY entity_id, created_at DESC
),
last_review_intent AS (
    SELECT DISTINCT ON (entity_id)
        entity_id, new_value, created_at
    FROM activity_log
    WHERE entity_type = 'edition'
      AND field_name  = 'to_check_in_detail'
    ORDER BY entity_id, created_at DESC
)
SELECT
    e.id,
    e.edition_display_name,
    k.name                                  AS gallery,
    e.is_stock_checked                      AS current_checked,
    (lci.new_value = 'true')                AS restore_checked,
    (lri.new_value = 'true')                AS restore_needs_review,
    lci.created_at                          AS last_ticked_at,
    lci.user_email                          AS last_ticked_by
FROM editions e
JOIN kendalls k                ON k.id = e.distributor_id
LEFT JOIN last_check_intent  lci ON lci.entity_id = e.id
LEFT JOIN last_review_intent lri ON lri.entity_id = e.id
WHERE e.is_printed
  AND NOT e.is_sold
  AND (lci.new_value = 'true' OR lri.new_value = 'true')
ORDER BY e.edition_display_name;


-- A3. One-line summary: how many editions are recoverable.
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
    count(*) FILTER (WHERE e.is_stock_checked)              AS currently_checked,
    count(*) FILTER (WHERE lci.new_value = 'true')          AS recoverable_checked,
    count(*)                                                AS kendalls_in_stock
FROM editions e
JOIN kendalls k               ON k.id = e.distributor_id
LEFT JOIN last_check_intent lci ON lci.entity_id = e.id
WHERE e.is_printed AND NOT e.is_sold;


-- ---------------------------------------------------------------------------
-- PART B — restore (WRITES; run only after PART A looks right)
-- ---------------------------------------------------------------------------
-- Deliberately left inside an open transaction. Inspect the RETURNING output,
-- then run COMMIT; to keep it or ROLLBACK; to discard it.

BEGIN;

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
    JOIN kendalls k                ON k.id = e.distributor_id
    LEFT JOIN last_check_intent  lci ON lci.entity_id = e.id
    LEFT JOIN last_review_intent lri ON lri.entity_id = e.id
    WHERE e.is_printed
      AND NOT e.is_sold
      AND (lci.new_value = 'true' OR lri.new_value = 'true')
)
UPDATE editions e
SET is_stock_checked  = t.want_checked OR e.is_stock_checked,
    to_check_in_detail = t.want_review  OR e.to_check_in_detail
FROM targets t
WHERE e.id = t.id
RETURNING e.id, e.edition_display_name, e.is_stock_checked, e.to_check_in_detail;

-- Review the rows above, then:
--   COMMIT;    -- keep the restore
--   ROLLBACK;  -- discard it
