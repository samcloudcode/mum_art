# Artwork Image Management

Administrator instructions for uploading artwork images to Supabase Storage.
Every upload and database update here affects production; preview the match and
confirm the target print before running a write.

## Upload or replace one image

1. Open **Artworks** and choose the artwork.
2. Select **Upload Image**, or **Change Image** if it already has one.
3. Choose or drag in a JPEG, PNG, WebP, or GIF under 10 MB.
4. Wait for the upload to finish and confirm the new image appears.

Changing an image updates production immediately. Double-check the artwork name
before choosing the file.

## Bulk import from the website (administrators)

From the repository root, preview product-to-artwork matches without writing:

```bash
uv run python scripts/import_from_website.py --dry-run
```

Review every match before running the same script without `--dry-run`. A
specific artwork can be selected with `--print-id <id>`.

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
   - Download the correct product image before using the in-app upload.
   - Some old Squarespace URLs are placeholders rather than artwork images.

2. **Bulk import script**: `uv run python scripts/import_from_website.py`
   - Use `--dry-run` to preview matches
   - Matches website products to database prints by name

## Storage Structure

- **Bucket**: `artwork-images`
- **Original path**: `prints/{airtable_id}/{sanitized_filename}.{ext}`
- **Thumbnail path**: `prints/{airtable_id}/thumb.webp`
- **Supported formats**: jpg, jpeg, png, webp, gif
- **Max size**: 10MB

## Thumbnail Generation

The browser generates a WebP thumbnail up to 400 pixels on its longest edge and
uploads it beside the original. Artwork lists use this stored thumbnail and fall
back to the original if it is unavailable.

## Database Column

The `prints.primary_image_path` column stores the original image's storage path.

## Troubleshooting

- **Images not showing after upload**: Hard refresh the browser (Ctrl+Shift+R)
- **In-app upload fails with auth error**: Confirm the signed-in user has storage
  permission
- **Bulk script fails with auth error**: Confirm its Supabase credentials are
  available in the untracked environment
- **2KB placeholder images**: These are broken Squarespace placeholders, need real URLs
