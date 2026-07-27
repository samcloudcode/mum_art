-- Migration: Reclassify the legacy unnumbered rows as artist's proofs
-- Follows 005_add_edition_type.sql, which left these alone pending a decision.
--
-- CORRECTION TO AN EARLIER DRAFT
--   This migration previously matched `edition_number = 0`. No such row exists:
--   the importer stores a blank Print Edition as NULL, not 0, so the statement
--   was a silent no-op. It also assumed the Osborne row was a stray placeholder
--   to be excluded (and possibly deleted). The source export marks that row
--   `Variation: AP` — it is a real proof that has not been printed yet.
--
-- THE SIX ROWS, AND THE EVIDENCE FOR EACH
--   Selected by airtable_id because the deciding evidence lives in the source
--   export's `Variation` column, which was never imported. Matching on data
--   present in the database (notes ILIKE 'ap') would catch only three of the
--   six. An explicit key list cannot over-match.
--
--   rec0Y0yWIbRD3drN3  Classics         Variation: AP   printed, sold, £90
--   recuvqMSu7ett2nvB  Corby            Variation: AP   printed, sold, £240
--   rec8iR0dsY2SJLnrl  Osborne          Variation: AP   not yet printed
--   recUyfFbYlqYN9lZ0  Yarmouth Pier    Variation: AP   printed, unsold, £225
--   recUFHISWW99d24Gk  Yarmouth Pier    notes 'ap yar pier'   printed, sold
--   rec3hBuT9anSbecLd  Seaview Regatta  notes 'ap-5'          printed, sold
--
--   The last two carry no Variation; their proof status is recorded in notes.
--   'ap-5' was added in the app after the January export, so the database is
--   the newer source for that row.
--
-- NUMBERING
--   Proof numbers continue each artwork's existing sequence rather than
--   restarting, because unique_print_edition is now
--   (print_id, edition_type, edition_number). After 005 converts the negatives,
--   Classics, Osborne and Yarmouth Pier already hold proofs, so these rows must
--   start above the highest existing one. row_number() supplies the offset so
--   two rows on the same artwork get distinct numbers instead of colliding.

WITH candidates AS (
    SELECT
        e.id,
        e.print_id,
        p.name AS print_name,
        row_number() OVER (PARTITION BY e.print_id ORDER BY e.id) AS offset_within_print
    FROM editions e
    JOIN prints p ON p.id = e.print_id
    WHERE e.edition_type = 'numbered'
      AND e.airtable_id IN (
          'rec0Y0yWIbRD3drN3',  -- Classics
          'recuvqMSu7ett2nvB',  -- Corby
          'rec8iR0dsY2SJLnrl',  -- Osborne, unprinted proof
          'recUyfFbYlqYN9lZ0',  -- Yarmouth Pier
          'recUFHISWW99d24Gk',  -- Yarmouth Pier
          'rec3hBuT9anSbecLd'   -- Seaview Regatta
      )
),
highest_existing_proof AS (
    SELECT print_id, max(edition_number) AS highest
    FROM editions
    WHERE edition_type = 'ap'
    GROUP BY print_id
)
UPDATE editions e
SET edition_type       = 'ap',
    edition_number     = coalesce(h.highest, 0) + c.offset_within_print,
    edition_display_name = c.print_name || ' AP ' || (coalesce(h.highest, 0) + c.offset_within_print)
FROM candidates c
LEFT JOIN highest_existing_proof h ON h.print_id = c.print_id
WHERE e.id = c.id
RETURNING e.id, e.edition_display_name, e.edition_number;

-- Re-running is a no-op: the rows converted above no longer match
-- edition_type = 'numbered', so they cannot be renumbered a second time.
--
-- The 22 remaining NULL-numbered rows are untouched. They carry no price,
-- gallery, sale, flag, size or note — blank rows carried over from Airtable.
-- They are not proofs and are deliberately left alone; deleting data is not
-- this migration's job.
