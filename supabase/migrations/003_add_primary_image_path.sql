-- Migration: Add primary_image_path column to prints
-- Purpose: Store the path to the main display image for each artwork
-- This enables image uploads and display in the web frontend

-- Add the primary_image_path column
ALTER TABLE prints
ADD COLUMN primary_image_path TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN prints.primary_image_path IS
'Storage path for the primary display image (e.g., prints/1/main.jpg). Used by frontend for artwork thumbnails and detail pages.';

-- Create an index for efficient queries (optional, mainly for consistency checks)
CREATE INDEX idx_prints_primary_image_path ON prints(primary_image_path) WHERE primary_image_path IS NOT NULL;
