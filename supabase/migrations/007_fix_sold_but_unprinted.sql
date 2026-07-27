-- Migration: mark genuinely-sold editions as printed
--
-- Ten editions are flagged sold but not printed, which should not be possible.
-- They are not one problem, though — they split cleanly in two.
--
-- SIX ARE REAL SALES. Settled, priced, most with a gallery, a date, and a buyer
-- named in the notes:
--
--   Ducie 86         £150.00  Direct             2021-06-01  'sarah butterworth sspp'
--   Priory 135       £250.00  Direct             settled     'tom durman'
--   Seaview AP 9     £240.00  Direct             2022-09-01  'philip hines'
--   West Cowes 113   £135.00  Green Buoy         settled
--   Miscellaneous    £100.00  Bramble and Berry  2019-12-11
--   Miscellaneous      £8.40  Seaview Gallery    2019-11-01
--
-- The money moved, so the print was made. is_printed is a data-entry gap and is
-- corrected here. Revenue already counted these correctly; nothing financial
-- changes.
--
-- FOUR ARE NOT TOUCHED. Ducie 4, Quay Rocks 1, Quay Rocks 2 and Scooter 192 are
-- flagged sold but have no price, no gallery, no sale date and are not settled.
-- There is no evidence a sale happened, so the likely error is the sold flag
-- itself, not the printed flag. Marking them printed would bury that. Clearing
-- is_sold is the plausible repair, but it is a judgement about what happened,
-- so it is left for a human:
--
--   SELECT id, edition_display_name FROM editions
--   WHERE is_sold AND NOT is_printed AND NOT is_settled
--     AND retail_price IS NULL AND date_sold IS NULL AND distributor_id IS NULL;
--
-- The guard below is written as a general rule rather than an id list, so the
-- same gap corrects itself if it recurs. Re-running is a no-op once no rows
-- match.

UPDATE editions
SET is_printed = true
WHERE is_sold
  AND NOT is_printed
  AND (                            -- some trace of an actual sale
        is_settled
     OR retail_price   IS NOT NULL
     OR date_sold      IS NOT NULL
     OR distributor_id IS NOT NULL
  )
RETURNING id, edition_display_name, retail_price, is_settled;
