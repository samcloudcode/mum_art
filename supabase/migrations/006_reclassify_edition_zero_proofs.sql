-- Migration: Reclassify the legacy edition-zero rows as artist's proofs
-- Follows 005_add_edition_type.sql, which left these alone pending a decision.
--
-- There are five rows with edition_number = 0, predating the negative-number
-- convention for proofs. Four are real prints that were never given a number;
-- one is a stray placeholder.
--
--   Classics - 0      x2  printed and sold, £90 each, different galleries
--   Corby - 0             printed and sold via Kendalls, £240, notes say "ap"
--   Yarmouth Pier - 0     printed, unsold, £225
--   Osborne - 0           not printed, not sold, no gallery, no price  <- stray
--
-- WHICH ROW IS THE STRAY
--   Selected by is_printed rather than by artwork name. The Osborne row is the
--   only edition-zero row that was never printed, so "was it actually made?" is
--   the real distinction, and it survives the artwork being renamed. A name
--   match would silently convert the wrong row if names ever shift.
--
-- NUMBERING
--   Proof numbers continue each artwork's existing sequence rather than
--   restarting, because unique_print_edition is now
--   (print_id, edition_type, edition_number) and three of these artworks
--   already have proofs:
--
--     Classics       has AP 1        -> its two zero rows become AP 2 and AP 3
--     Corby          has none        -> becomes AP 1
--     Yarmouth Pier  has AP 1        -> becomes AP 2
--
--   row_number() supplies the offset so multiple zero rows on one artwork get
--   distinct numbers instead of colliding on the same value.

WITH candidates AS (
    SELECT
        e.id,
        e.print_id,
        p.name AS print_name,
        row_number() OVER (PARTITION BY e.print_id ORDER BY e.id) AS offset_within_print
    FROM editions e
    JOIN prints p ON p.id = e.print_id
    WHERE e.edition_number = 0
      AND e.edition_type = 'numbered'
      AND e.is_printed            -- excludes the Osborne placeholder
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
WHERE e.id = c.id;

-- Re-running is a no-op: the rows converted above no longer match
-- edition_type = 'numbered', so they cannot be renumbered a second time.

-- The Osborne placeholder is deliberately left as numbered edition 0. It is not
-- deleted here because deleting data is not this migration's job — if it is
-- genuinely junk, remove it explicitly:
--
--   DELETE FROM editions e USING prints p
--   WHERE p.id = e.print_id AND p.name = 'Osborne'
--     AND e.edition_number = 0 AND NOT e.is_printed AND NOT e.is_sold;
