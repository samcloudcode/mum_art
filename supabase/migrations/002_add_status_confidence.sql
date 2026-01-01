-- Migration: Add status_confidence column to editions
-- Purpose: Track data quality for editions where we don't know the final status
-- This allows filtering out legacy/unknown items from day-to-day operations

-- Add the status_confidence column with a check constraint
ALTER TABLE editions
ADD COLUMN status_confidence TEXT DEFAULT 'verified'
CHECK (status_confidence IN ('verified', 'unverified', 'legacy_unknown'));

-- Add a comment explaining the column
COMMENT ON COLUMN editions.status_confidence IS
'Data quality indicator: verified = confirmed status, unverified = needs review, legacy_unknown = historical data with unknown status';

-- Create an index for efficient filtering (most queries will filter by this)
CREATE INDEX idx_editions_status_confidence ON editions(status_confidence);

-- For existing data, mark all as verified (current behavior assumed correct)
-- Legacy items can be batch-updated later as needed
UPDATE editions SET status_confidence = 'verified' WHERE status_confidence IS NULL;
