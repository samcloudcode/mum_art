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
-- The unnumbered rows — HANDLED IN 006, not here
-- ============================================================================
-- An earlier draft of this note described them as "edition zero" rows and
-- guessed at what they were. Checked against the database and the source
-- export, both details were wrong: the importer stores a blank Print Edition
-- as NULL rather than 0, and the Osborne row that looked like a stray
-- placeholder is marked `Variation: AP` in the export — an artist's proof
-- that has not been printed yet.
--
-- There are six such proofs, not four, and 006 converts all six. See that file
-- for the per-row evidence. A further 22 NULL-numbered rows carry no data at
-- all and are left alone by both migrations.
-- ============================================================================
