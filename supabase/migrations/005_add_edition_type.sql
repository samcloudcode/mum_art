-- Migration: Make artist's proofs a first-class edition type
-- See planning/PRP-artist-proofs.md
--
-- APs were stored as NEGATIVE edition numbers. That was never a description of
-- what an AP is — it was a workaround for this constraint:
--
--     CONSTRAINT unique_print_edition UNIQUE (print_id, edition_number)
--
-- An AP needed a slot in that constraint and negatives were the unused ones.
-- Widening the constraint to include a type removes the need for the trick, so
-- an AP becomes "AP 1" rather than "minus one", and AP 1 can coexist with
-- numbered edition 1.
--
-- STATEMENT ORDER MATTERS HERE. The old constraint must be dropped BEFORE the
-- negatives are flipped positive, or converting -1 to 1 collides with the
-- existing numbered edition 1 on the same print.

-- 1. The type. Everything is a numbered edition until proven otherwise.
ALTER TABLE editions
ADD COLUMN IF NOT EXISTS edition_type TEXT NOT NULL DEFAULT 'numbered';

ALTER TABLE editions DROP CONSTRAINT IF EXISTS check_edition_type;
ALTER TABLE editions ADD CONSTRAINT check_edition_type
    CHECK (edition_type IN ('numbered', 'ap'));

COMMENT ON COLUMN editions.edition_type IS
'numbered = part of the limited run and counts toward the edition total; ap = artist''s proof, sits outside the run.';

-- 2. Drop the old constraint first (see note above).
ALTER TABLE editions DROP CONSTRAINT IF EXISTS unique_print_edition;

-- 3. Convert the existing negative-numbered APs.
--    Verified against the source export: no print has two negatives that
--    collapse to the same positive, so abs() cannot create a duplicate.
UPDATE editions
SET edition_type   = 'ap',
    edition_number = abs(edition_number)
WHERE edition_number < 0;

-- 4. Repair the display names, which currently read "Ducie - -1".
--    Matches the format editionDisplayName() produces in the web app.
UPDATE editions e
SET edition_display_name = p.name || ' AP ' || e.edition_number
FROM prints p
WHERE p.id = e.print_id
  AND e.edition_type = 'ap';

-- 5. The widened constraint. Type is now part of the key.
ALTER TABLE editions ADD CONSTRAINT unique_print_edition
    UNIQUE (print_id, edition_type, edition_number);

-- 6. APs are a small subset and are queried as a group.
CREATE INDEX IF NOT EXISTS idx_editions_edition_type
    ON editions(edition_type) WHERE edition_type <> 'numbered';


-- ============================================================================
-- The edition-zero rows — HANDLED IN 006, not here
-- ============================================================================
-- 006_reclassify_edition_zero_proofs.sql converts the printed ones to proofs
-- and leaves the unprinted Osborne placeholder alone. Kept below for context.
-- ============================================================================
-- These predate the negative convention and are left as numbered edition 0,
-- exactly as they are today. Converting them is a judgement call about what
-- they represent, so it is yours to make rather than this migration's:
--
--   Corby - 0          Notes field literally says "ap". Sold via Kendalls,
--                      £240. Almost certainly an artist's proof that never got
--                      a negative number.
--   Classics - 0  (x2) Both printed and sold at £90, different galleries.
--                      Real sales that were never numbered.
--   Yarmouth Pier - 0  Printed, unsold, £225, DIRECT OLD. A real print.
--   Osborne - 0        Empty: not printed, not sold, no gallery, no price.
--                      Looks like a stray placeholder row.
--
-- To reclassify the Corby row once you have confirmed it, adjusting the number
-- to whatever AP it should be:
--
--   UPDATE editions SET edition_type = 'ap', edition_number = 1
--   WHERE id = (SELECT e.id FROM editions e
--               JOIN prints p ON p.id = e.print_id
--               WHERE p.name = 'Corby' AND e.edition_number = 0);
-- ============================================================================
