# Project Requirements Plan: Restore Artwork Images

## Overview

Artwork images are missing from the UI because `primary_image_path` is null for all 42 prints. The images still physically exist in Supabase Storage at `prints/{old_id}/main.webp` (old numeric IDs 45–86), but the prints table was wiped and reimported with new IDs (564–605), losing the path references.

## Root Cause

1. Images were bulk-imported → stored at `prints/{db_id}/main.webp` → `primary_image_path` set correctly
2. `smart_import.py` ran (Jan 1 2026) with "clear all existing data" → prints table wiped → reimported with new IDs → `primary_image_path` reset to null
3. Storage files were never touched — they still exist at the old paths

## What We Know

- **38 storage folders** exist: `45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 73, 74, 75, 76, 78, 79, 82, 83, 84, 85, 86` (some gaps)
- Each folder contains `main.webp` (original) and `thumb.webp` (thumbnail)
- **42 prints** currently in DB with IDs 564–605
- **37 prints** have `image_urls` (Airtable source URLs — now expired/404)

## Approach

The old storage IDs were assigned sequentially by Postgres when prints were first imported from `Prints-Grid view.csv`. Map old ID → print name by checking the order prints were inserted.

### Step 1: Determine the old ID → print name mapping

Run this query to see prints ordered by `airtable_id` (which reflects CSV import order):

```sql
SELECT airtable_id, name FROM prints ORDER BY airtable_id;
```

Cross-reference with the CSV order in `airtable_export/Prints-Grid view.csv`. The first print imported got the lowest ID (45), the second got 46, etc. Gaps in storage (missing 72, 77, 80, 81) mean those prints had no image.

To verify a mapping, check a known print: Bembridge is likely ID 45 (first in CSV). Confirm by visiting:
```
https://jfgoonjqdspogbkjpgcb.supabase.co/storage/v1/object/public/artwork-images/prints/45/main.webp
```

### Step 2: Build the mapping script

Create `scripts/restore_image_paths.py`:

```python
#!/usr/bin/env python3
"""
Restore primary_image_path for all prints by mapping old storage IDs to current print IDs.
Run: uv run python scripts/restore_image_paths.py --dry-run
Run: uv run python scripts/restore_image_paths.py
"""
import os
from supabase import create_client

SUPABASE_URL = "https://jfgoonjqdspogbkjpgcb.supabase.co"
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = "artwork-images"

# Manual mapping: old_db_id -> airtable_id
# Derived by matching CSV import order to sequential Postgres IDs
# Verify each by checking the image visually at:
# https://jfgoonjqdspogbkjpgcb.supabase.co/storage/v1/object/public/artwork-images/prints/{old_id}/main.webp
ID_MAP = {
    # old_id: airtable_id
    # Fill this in after Step 1
}
```

### Step 3: Alternative — use Supabase dashboard to identify images visually

If the mapping is hard to determine programmatically:

1. Go to Supabase dashboard → Storage → artwork-images → prints
2. Click each numbered folder, view `main.webp`
3. Match visually to the print name
4. Note the mapping (38 images, ~10 minutes)

### Step 4: Update the DB

Once the mapping is confirmed, run this SQL (one row per print):

```sql
UPDATE prints SET primary_image_path = 'prints/45/main.webp' WHERE airtable_id = 'recejJYkoDnGYh8MD'; -- Bembridge
UPDATE prints SET primary_image_path = 'prints/46/main.webp' WHERE airtable_id = 'recaDeP2E0b7HR6aJ'; -- Brambles
-- etc.
```

Or via a Python script that reads the mapping and bulk-updates.

### Step 5: Verify

After updating, visit `/artworks` — images should appear immediately (no code changes needed, the storage paths still work).

## Alternative: Re-import images from Airtable

If the visual mapping is too tedious:

1. Re-export prints from Airtable to get fresh `image_urls`
2. Run `scripts/bulk_import_images.py --from-urls` — this downloads from Airtable URLs and uploads to `prints/{airtable_id}/main.webp` (new path format), then sets `primary_image_path`
3. This also fixes the path format to use `airtable_id` going forward (more resilient to reimports)

**This is the better long-term fix** as it also migrates to the stable `airtable_id`-based paths.

## Fix smart_import.py to preserve image paths

After restoring, prevent this happening again by updating `smart_import.py` to preserve `primary_image_path` on reimport:

```python
# When upserting prints, use ON CONFLICT (airtable_id) DO UPDATE
# but exclude primary_image_path from the update so it's never overwritten
```

Or simpler: after the import, run a query to restore paths from a backup/mapping file.

## Files Involved

- `scripts/restore_image_paths.py` — new script to write
- `scripts/bulk_import_images.py` — alternative re-import approach
- `smart_import.py` — fix to preserve `primary_image_path` on reimport
- `airtable_export/Prints-Grid view.csv` — source of print order for mapping
