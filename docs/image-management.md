# Artwork Image Management

Instructions for Claude to upload artwork images to Supabase Storage.

## Quick Upload (Single Image)

When given a print name and image URL:

```bash
cd /home/samstitt/Dev/mum_art && uv run python3 << 'EOF'
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env')
load_dotenv('web/.env.local')

supabase = create_client(os.getenv('NEXT_PUBLIC_SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Download image
import httpx
url = "YOUR_IMAGE_URL_HERE"
response = httpx.get(url, follow_redirects=True)
data = response.content

# Determine extension from URL or content-type
ext = ".jpg"  # or .png, .webp based on URL/content-type

# Upload (replace PRINT_ID with actual ID)
print_id = PRINT_ID
storage_path = f"prints/{print_id}/main{ext}"

try:
    supabase.storage.from_('artwork-images').remove([storage_path])
except: pass

supabase.storage.from_('artwork-images').upload(storage_path, data, file_options={'content-type': 'image/jpeg'})
supabase.table('prints').update({'primary_image_path': storage_path}).eq('id', print_id).execute()
print(f"Uploaded to {storage_path}")
EOF
```

## Batch Upload (Multiple Images)

When given multiple URLs, create a mapping dict and run:

```python
MAPPINGS = {
    "filename1.jpg": print_id_1,
    "filename2.png": print_id_2,
}
```

Then download all to `/tmp/artwork_images/` and upload using the batch script pattern.

## Finding Missing Images

### Check which prints need images:

```sql
SELECT id, name FROM prints WHERE primary_image_path IS NULL ORDER BY name;
```

### Check current image status:

```sql
SELECT id, name, primary_image_path IS NOT NULL as has_image
FROM prints ORDER BY name;
```

### Verify storage files exist:

```sql
SELECT name, (metadata->>'size')::int as size_bytes
FROM storage.objects
WHERE bucket_id = 'artwork-images'
ORDER BY name;
```

## Image Sources

1. **Primary source**: https://suestitt.com/shop
   - Products with `images.squarespace-cdn.com` URLs have real images
   - Products with `static1.squarespace.com` URLs are placeholders (won't work)

2. **Bulk import script**: `uv run python scripts/import_from_website.py`
   - Use `--dry-run` to preview matches
   - Matches website products to database prints by name

3. **Manual URLs**: User can provide direct Squarespace CDN URLs like:
   ```
   https://images.squarespace-cdn.com/content/v1/58c3ea3db8a79bba77831dd3/...
   ```

## Storage Structure

- **Bucket**: `artwork-images`
- **Path format**: `prints/{print_id}/main.{ext}`
- **Supported formats**: jpg, jpeg, png, webp, gif
- **Max size**: 10MB

## Thumbnail Generation

Supabase Pro generates thumbnails on-the-fly via URL params:

```
# Original
/storage/v1/object/public/artwork-images/prints/42/main.jpg

# Thumbnail (300x300)
/storage/v1/render/image/public/artwork-images/prints/42/main.jpg?width=300&height=300&resize=cover
```

## Database Column

The `prints.primary_image_path` column stores the storage path (e.g., `prints/42/main.jpg`).

## Troubleshooting

- **Images not showing after upload**: Hard refresh the browser (Ctrl+Shift+R)
- **Upload fails with auth error**: Check `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- **2KB placeholder images**: These are broken Squarespace placeholders, need real URLs
