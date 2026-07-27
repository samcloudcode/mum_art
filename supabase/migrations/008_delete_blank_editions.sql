-- Migration: delete the blank edition rows carried over from Airtable
--
-- 22 rows hold no information whatsoever: no edition number, no price, no
-- gallery, no sale, no size, no frame, no notes, and every flag false. Their
-- display names are truncated stubs — "COWES RACE DAY -", "OTTO  -" — an
-- edition name with the number missing, because there never was one.
--
--   Cowes Race Day 4, Yarmouth Pier 4, The Needles Lighthouse 4, Otto 3,
--   Scows 3, Miscellaneous 2, No Man's Fort 1, Scooter 1
--
-- WHY A PREDICATE RATHER THAN AN ID LIST
--   Every condition below must hold, so this cannot delete a row that carries
--   any data at all. An id list would be equally precise but would not say why
--   these rows in particular are safe to remove, and would go stale if the same
--   junk reappeared under new ids.
--
-- WHAT IS DELIBERATELY NOT MATCHED
--   Two Miscellaneous rows also lack an edition number but are real sales
--   (£100 and £8.40, settled, with galleries and dates). The is_sold /
--   retail_price / distributor_id conditions exclude them.
--
--   Artist's proofs are excluded by edition_type, though after 006 they all
--   carry numbers anyway.
--
-- THESE WILL COME BACK ON THE NEXT IMPORT
--   All 22 still exist in airtable_export/ with live record_ids, and
--   smart_import.py upserts on airtable_id. Re-importing that export recreates
--   every one of them. This migration is a one-time clean of the current
--   database, not a permanent fix. Making it stick would need the importer to
--   skip source rows that have no edition number and no data — a deliberate
--   choice not made here.
--
-- There is no undo. The rows carry no information to lose, and the same export
-- can recreate them, but a delete is still a delete.

DELETE FROM editions
WHERE edition_number IS NULL
  AND edition_type = 'numbered'
  AND NOT is_printed
  AND NOT is_sold
  AND NOT is_settled
  AND retail_price   IS NULL
  AND distributor_id IS NULL
  AND date_sold      IS NULL
  AND size           IS NULL
  AND frame_type     IS NULL
  AND notes          IS NULL
RETURNING id, edition_display_name;

-- The four activity_log rows referencing deleted editions (a size tidy-up on
-- the Needles rows in June) are left in place. activity_log has no foreign key
-- to editions, and an audit trail should keep recording what happened even
-- once the row it describes is gone.
