#!/usr/bin/env python3
"""
Import artwork images from suestitt.com into Supabase Storage.

This script:
1. Fetches product data from suestitt.com/shop?format=json
2. Matches products to prints in the database by name
3. Downloads images and uploads to Supabase Storage
4. Updates the primary_image_path in the database

Usage:
    # Dry run - show matches without downloading
    uv run python scripts/import_from_website.py --dry-run

    # Import all matched images
    uv run python scripts/import_from_website.py

    # Import specific print by ID
    uv run python scripts/import_from_website.py --print-id 45
"""

import os
import sys
import re
import argparse
from pathlib import Path
from urllib.parse import unquote
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env from multiple locations
load_dotenv()  # Root .env
load_dotenv(Path(__file__).parent.parent / "web" / ".env.local")  # web/.env.local

# Supabase configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
BUCKET_NAME = "artwork-images"

SHOP_URL = "https://suestitt.com/shop?format=json"


def get_supabase_client() -> Client:
    """Create a Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Missing Supabase credentials in .env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_website_products() -> list[dict]:
    """Fetch all products from the Squarespace shop."""
    print("Fetching products from suestitt.com...")

    with httpx.Client(follow_redirects=True, timeout=30) as client:
        response = client.get(SHOP_URL)
        response.raise_for_status()
        data = response.json()

    products = []

    # Squarespace JSON structure varies - try common patterns
    items = data.get("items", []) or data.get("collection", {}).get("items", [])

    for item in items:
        title = item.get("title", "")

        # Get image URL from various possible locations
        image_url = None

        # Try assetUrl first
        if item.get("assetUrl"):
            image_url = item["assetUrl"]
        # Then try items array
        elif item.get("items") and len(item["items"]) > 0:
            first_variant = item["items"][0]
            if first_variant.get("assetUrl"):
                image_url = first_variant["assetUrl"]
        # Try mainImage
        elif item.get("mainImage", {}).get("assetUrl"):
            image_url = item["mainImage"]["assetUrl"]

        if title and image_url:
            products.append({
                "title": title,
                "image_url": image_url,
                "slug": item.get("urlId", ""),
            })

    print(f"Found {len(products)} products with images")
    return products


def normalize_name(name: str) -> str:
    """Normalize a name for matching."""
    # Remove common prefixes/suffixes
    name = name.lower().strip()
    name = re.sub(r'^(landscape|portrait|small|large|framed|mounted)\s+', '', name)
    name = re.sub(r'\s+(small|large|framed|mounted|v\d+)$', '', name)
    # Remove special characters and extra spaces
    name = re.sub(r'[^\w\s]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name.strip()


def match_products_to_prints(products: list[dict], prints: list[dict]) -> list[dict]:
    """Match website products to database prints."""
    matches = []

    # Create normalized name lookup for prints
    prints_lookup = {}
    for p in prints:
        norm_name = normalize_name(p["name"])
        prints_lookup[norm_name] = p
        # Also add without common suffixes
        for suffix in [" lighthouse", " harbour", " harbor", " pier", " station"]:
            if norm_name.endswith(suffix):
                prints_lookup[norm_name.replace(suffix, "")] = p

    # Try to match each product
    for product in products:
        norm_title = normalize_name(product["title"])

        # Direct match
        if norm_title in prints_lookup:
            matches.append({
                "product": product,
                "print": prints_lookup[norm_title],
                "match_type": "exact",
            })
            continue

        # Partial match - product name contains print name or vice versa
        for norm_name, print_data in prints_lookup.items():
            if norm_name in norm_title or norm_title in norm_name:
                matches.append({
                    "product": product,
                    "print": print_data,
                    "match_type": "partial",
                })
                break

    return matches


def download_image(url: str) -> tuple[bytes, str] | None:
    """Download an image. Returns (content, extension) or None."""
    try:
        with httpx.Client(follow_redirects=True, timeout=60) as client:
            response = client.get(url)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")

            if "jpeg" in content_type or "jpg" in content_type:
                ext = ".jpg"
            elif "png" in content_type:
                ext = ".png"
            elif "webp" in content_type:
                ext = ".webp"
            else:
                # Try to get from URL
                path = unquote(url.split("?")[0])
                if path.lower().endswith(".jpg") or path.lower().endswith(".jpeg"):
                    ext = ".jpg"
                elif path.lower().endswith(".png"):
                    ext = ".png"
                else:
                    ext = ".jpg"  # Default

            return response.content, ext

    except Exception as e:
        print(f"  Error downloading: {e}")
        return None


def upload_to_storage(supabase: Client, print_id: int, image_data: bytes, ext: str) -> str | None:
    """Upload image to Supabase Storage."""
    path = f"prints/{print_id}/main{ext}"
    mime_types = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    mime_type = mime_types.get(ext, "image/jpeg")

    try:
        # Remove existing file if any
        try:
            supabase.storage.from_(BUCKET_NAME).remove([path])
        except Exception:
            pass

        supabase.storage.from_(BUCKET_NAME).upload(
            path,
            image_data,
            file_options={"content-type": mime_type, "cache-control": "3600"},
        )
        return path

    except Exception as e:
        print(f"  Error uploading: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Import images from suestitt.com")
    parser.add_argument("--dry-run", action="store_true", help="Show matches without importing")
    parser.add_argument("--print-id", type=int, help="Import only specific print ID")
    args = parser.parse_args()

    supabase = get_supabase_client()

    # Fetch products from website
    products = fetch_website_products()

    if not products:
        print("No products found on website")
        return

    # Fetch prints from database
    print("\nFetching prints from database...")
    response = supabase.table("prints").select("id, name, primary_image_path").execute()
    prints = response.data
    print(f"Found {len(prints)} prints in database")

    # Filter by print ID if specified
    if args.print_id:
        prints = [p for p in prints if p["id"] == args.print_id]
        if not prints:
            print(f"Print ID {args.print_id} not found")
            return

    # Match products to prints
    print("\nMatching products to prints...")
    matches = match_products_to_prints(products, prints)

    # Filter out prints that already have images (unless specific ID requested)
    if not args.print_id:
        matches = [m for m in matches if not m["print"].get("primary_image_path")]

    print(f"\nFound {len(matches)} matches to import:")

    if not matches:
        print("No new images to import")
        return

    # Show matches
    for match in matches:
        product = match["product"]
        print_data = match["print"]
        match_type = match["match_type"]
        has_image = "✓" if print_data.get("primary_image_path") else " "

        print(f"  [{has_image}] {product['title'][:40]:<40} -> [{print_data['id']}] {print_data['name'][:30]} ({match_type})")

    if args.dry_run:
        print("\n[DRY RUN] No changes made")
        return

    # Import images
    print("\nImporting images...")
    imported = 0
    failed = 0

    for match in matches:
        product = match["product"]
        print_data = match["print"]
        print_id = print_data["id"]

        print(f"\n  [{print_id}] {print_data['name']}...")
        print(f"    Downloading from: {product['image_url'][:60]}...")

        result = download_image(product["image_url"])
        if not result:
            failed += 1
            continue

        image_data, ext = result
        print(f"    Downloaded {len(image_data) / 1024:.1f} KB")

        path = upload_to_storage(supabase, print_id, image_data, ext)
        if not path:
            failed += 1
            continue

        # Update database
        try:
            supabase.table("prints").update({"primary_image_path": path}).eq("id", print_id).execute()
            print(f"    Saved: {path}")
            imported += 1
        except Exception as e:
            print(f"    Error updating database: {e}")
            failed += 1

    print(f"\n\nImport complete: {imported} imported, {failed} failed")


if __name__ == "__main__":
    main()
