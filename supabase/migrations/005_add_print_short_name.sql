-- Migration: Add short_name column to prints
-- Purpose: Store abbreviated print names for handwritten notes and compact displays
-- The existing 'name' column becomes the full display name

-- Add the short_name column
ALTER TABLE prints
ADD COLUMN short_name VARCHAR(30);

-- Add a comment explaining the column
COMMENT ON COLUMN prints.short_name IS
'Abbreviated name for handwritten notes and compact displays (e.g., "RYS" for "Royal Yacht Squadron")';

COMMENT ON COLUMN prints.name IS
'Full display name for the print (e.g., "Royal Yacht Squadron")';

-- Create an index for lookups by short_name
CREATE INDEX idx_prints_short_name ON prints(short_name);
