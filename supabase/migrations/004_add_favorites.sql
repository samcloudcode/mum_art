-- Migration: Add is_favorite to distributors and prints
-- Purpose: Let frequently-used galleries and artworks be pinned to the top of
-- the dropdowns used when editing editions.
--
-- NOTE ON DRIFT: distributors.is_favorite already exists in the live database.
-- It was added out-of-band — the app reads and writes it (inventory-store.ts
-- toggleDistributorFavorite, and the star button on the galleries page) and it
-- is present in web/src/lib/types.ts, but no migration in this directory ever
-- created it. This migration is written to be safe to run either way, so the
-- repo becomes an accurate description of the schema again.
--
-- prints.is_favorite is genuinely new.

-- Distributors: reconcile the drifted column.
ALTER TABLE distributors
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN distributors.is_favorite IS
'Pins this gallery to the top of location dropdowns and the galleries list.';

-- Prints: new column.
ALTER TABLE prints
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN prints.is_favorite IS
'Pins this artwork to the top of artwork dropdowns and filters.';

-- Existing rows predate the column and would otherwise be NULL, which sorts
-- inconsistently against FALSE. Normalise so "not a favourite" is one value.
UPDATE distributors SET is_favorite = FALSE WHERE is_favorite IS NULL;
UPDATE prints        SET is_favorite = FALSE WHERE is_favorite IS NULL;

-- Partial indexes: favourites are a small subset, so only they are worth indexing.
CREATE INDEX IF NOT EXISTS idx_distributors_is_favorite
    ON distributors(is_favorite) WHERE is_favorite;
CREATE INDEX IF NOT EXISTS idx_prints_is_favorite
    ON prints(is_favorite) WHERE is_favorite;
