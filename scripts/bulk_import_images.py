#!/usr/bin/env python3
"""
Bulk import images to Supabase Storage for artwork prints.

This script can import images from:
1. Existing image_urls in the database
2. A local folder of images

Usage:
    # Import from existing image_urls in database
    uv run python scripts/bulk_import_images.py --from-urls

    # Import from a local folder (images named by print ID or name)
    uv run python scripts/bulk_import_images.py --from-folder /path/to/images

    # Dry run (show what would be imported without making changes)
    uv run python scripts/bulk_import_images.py --from-urls --dry-run
"""

import os
import sys
import argparse
import mimetypes
from pathlib import Path
from urllib.parse import urlparse
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
BUCKET_NAME = "artwork-images"

# Supported image types
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def get_supabase_client() -> Client:
    """Create a Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
            "or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env"
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def download_image(url: str) -> tuple[bytes, str] | None:
    """Download an image from a URL. Returns (content, extension) or None on failure."""
    try:
        with httpx.Client(follow_redirects=True, timeout=30) as client:
            response = client.get(url)
            response.raise_for_status()

            # Determine extension from content-type or URL
            content_type = response.headers.get("content-type", "")
            ext = None

            if "jpeg" in content_type or "jpg" in content_type:
                ext = ".jpg"
            elif "png" in content_type:
                ext = ".png"
            elif "webp" in content_type:
                ext = ".webp"
            elif "gif" in content_type:
                ext = ".gif"
            else:
                # Try to get from URL
                parsed = urlparse(url)
                path_ext = Path(parsed.path).suffix.lower()
                if path_ext in SUPPORTED_EXTENSIONS:
                    ext = path_ext

            if not ext:
                print(f"  Warning: Could not determine image type for {url}")
                return None

            return response.content, ext

    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return None


def upload_to_storage(
    supabase: Client, print_id: int, image_data: bytes, extension: str
) -> str | None:
    """Upload image to Supabase Storage. Returns the path on success."""
    path = f"prints/{print_id}/main{extension}"
    mime_type = MIME_TYPES.get(extension, "image/jpeg")

    try:
        # Try to remove existing file first (ignore errors)
        try:
            supabase.storage.from_(BUCKET_NAME).remove([path])
        except Exception:
            pass

        # Upload new file
        supabase.storage.from_(BUCKET_NAME).upload(
            path,
            image_data,
            file_options={"content-type": mime_type, "cache-control": "3600"},
        )
        return path

    except Exception as e:
        print(f"  Error uploading to storage: {e}")
        return None


def update_print_image_path(supabase: Client, print_id: int, path: str) -> bool:
    """Update the primary_image_path for a print."""
    try:
        supabase.table("prints").update({"primary_image_path": path}).eq(
            "id", print_id
        ).execute()
        return True
    except Exception as e:
        print(f"  Error updating database: {e}")
        return False


def import_from_urls(supabase: Client, dry_run: bool = False) -> None:
    """Import images from existing image_urls in the database."""
    print("Fetching prints with image_urls...")

    response = supabase.table("prints").select("id, name, image_urls, primary_image_path").execute()
    prints = response.data

    prints_with_urls = [p for p in prints if p.get("image_urls") and len(p["image_urls"]) > 0]

    if not prints_with_urls:
        print("No prints found with image_urls to import.")
        return

    print(f"Found {len(prints_with_urls)} prints with image_urls")

    imported = 0
    skipped = 0
    failed = 0

    for print_data in prints_with_urls:
        print_id = print_data["id"]
        name = print_data["name"]
        urls = print_data["image_urls"]
        existing_path = print_data.get("primary_image_path")

        # Skip if already has an image
        if existing_path:
            print(f"  [{print_id}] {name}: Already has image, skipping")
            skipped += 1
            continue

        # Use first URL
        url = urls[0] if isinstance(urls, list) else urls
        print(f"  [{print_id}] {name}: Importing from {url[:60]}...")

        if dry_run:
            print(f"    [DRY RUN] Would import image")
            imported += 1
            continue

        # Download image
        result = download_image(url)
        if not result:
            failed += 1
            continue

        image_data, ext = result

        # Upload to storage
        path = upload_to_storage(supabase, print_id, image_data, ext)
        if not path:
            failed += 1
            continue

        # Update database
        if update_print_image_path(supabase, print_id, path):
            print(f"    Imported successfully: {path}")
            imported += 1
        else:
            failed += 1

    print(f"\nImport complete: {imported} imported, {skipped} skipped, {failed} failed")


def import_from_folder(supabase: Client, folder_path: str, dry_run: bool = False) -> None:
    """Import images from a local folder."""
    folder = Path(folder_path)

    if not folder.exists():
        print(f"Error: Folder {folder_path} does not exist")
        return

    print(f"Scanning {folder_path} for images...")

    # Get all prints for matching
    response = supabase.table("prints").select("id, name, primary_image_path").execute()
    prints = {p["name"].lower(): p for p in response.data}
    prints_by_id = {str(p["id"]): p for p in response.data}

    # Find image files
    image_files = [
        f for f in folder.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    if not image_files:
        print("No image files found in folder")
        return

    print(f"Found {len(image_files)} image files")

    imported = 0
    skipped = 0
    not_matched = 0

    for image_file in image_files:
        stem = image_file.stem.lower()

        # Try to match by ID first, then by name
        print_data = prints_by_id.get(stem) or prints.get(stem)

        if not print_data:
            print(f"  {image_file.name}: No matching print found")
            not_matched += 1
            continue

        print_id = print_data["id"]
        name = print_data["name"]
        existing_path = print_data.get("primary_image_path")

        if existing_path:
            print(f"  {image_file.name} -> [{print_id}] {name}: Already has image, skipping")
            skipped += 1
            continue

        print(f"  {image_file.name} -> [{print_id}] {name}")

        if dry_run:
            print(f"    [DRY RUN] Would import image")
            imported += 1
            continue

        # Read file
        image_data = image_file.read_bytes()
        ext = image_file.suffix.lower()

        # Upload to storage
        path = upload_to_storage(supabase, print_id, image_data, ext)
        if not path:
            continue

        # Update database
        if update_print_image_path(supabase, print_id, path):
            print(f"    Imported successfully: {path}")
            imported += 1

    print(f"\nImport complete: {imported} imported, {skipped} skipped, {not_matched} not matched")


def main():
    parser = argparse.ArgumentParser(
        description="Bulk import images to Supabase Storage"
    )
    parser.add_argument(
        "--from-urls",
        action="store_true",
        help="Import from existing image_urls in database",
    )
    parser.add_argument(
        "--from-folder",
        type=str,
        help="Import from a local folder of images",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be imported without making changes",
    )

    args = parser.parse_args()

    if not args.from_urls and not args.from_folder:
        parser.print_help()
        print("\nError: Must specify --from-urls or --from-folder")
        sys.exit(1)

    supabase = get_supabase_client()

    if args.from_urls:
        import_from_urls(supabase, dry_run=args.dry_run)
    elif args.from_folder:
        import_from_folder(supabase, args.from_folder, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
