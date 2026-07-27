-- Migration: mark the four unverifiable sales as legacy_unknown
--
-- Four editions are flagged sold but carry no evidence that a sale happened:
-- no price, no gallery, no sale date, not settled, and not even marked printed.
--
--   106888  Ducie - 4         source also has Date in Gallery 2020-11-14
--   110203  Quay Rocks - 1
--   110204  Quay Rocks - 2
--   111631  Scooter - 192
--
-- WHERE THE FLAG CAME FROM
--   Not a mis-click in the app. All four have `Sold: checked` in the Airtable
--   export and zero rows in activity_log, so the tick predates this system.
--   Everything else about them was blank at source too.
--
-- WHY NOT JUST FIX IT
--   The row is internally contradictory — sold but never printed — so one of
--   the two flags is wrong, and nothing in the data says which:
--
--     Clearing is_sold      asserts no sale happened.
--     Setting is_printed    asserts a sale happened and the details were lost.
--
--   Both invent a fact. 007 corrected six similar rows precisely because those
--   had corroboration — settled, priced, buyers named in the notes. These four
--   have none, and Ducie's gallery date shows only that the print existed, not
--   that it sold.
--
--   status_confidence = 'legacy_unknown' is the field's documented meaning:
--   "historical data with unknown status". It records what is actually true —
--   that the status is unreliable — without deciding which flag to trust. The
--   app already supports it: an "Unknown" badge, a callout on the edition
--   detail page, and exclusion from the dashboard's stats and from the default
--   edition list. 52 editions already carry it.
--
--   The contradictory flags are deliberately left as they are. Overwriting them
--   would destroy the only record of what the source claimed, and the label now
--   tells the app not to trust them.
--
-- REVERSIBLE
--   Nothing is overwritten, so undoing this is a matter of setting the four
--   rows back to 'verified':
--
--     UPDATE editions SET status_confidence = 'verified'
--     WHERE id IN (106888, 110203, 110204, 111631);

UPDATE editions
SET status_confidence = 'legacy_unknown'
WHERE is_sold
  AND NOT is_printed
  AND NOT is_settled
  AND retail_price   IS NULL
  AND date_sold      IS NULL
  AND distributor_id IS NULL
  AND status_confidence <> 'legacy_unknown'
RETURNING id, edition_display_name, is_sold, is_printed, status_confidence;

-- Re-running is a no-op: the rows no longer match the final condition.
