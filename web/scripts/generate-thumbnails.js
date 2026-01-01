#!/usr/bin/env node

/**
 * Generate thumbnails for all existing artwork images
 *
 * Usage: node scripts/generate-thumbnails.js
 *
 * Requires environment variables:
 * - SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js')
const sharp = require('sharp')

// Configuration
const BUCKET_NAME = 'artwork-images'
const THUMB_SIZE = 400
const THUMB_QUALITY = 85

// Hardcoded Supabase URL (public info), service key from env
const supabaseUrl = 'https://jfgoonjqdspogbkjpgcb.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('- SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function listAllImages() {
  const images = []

  // List all folders in prints/
  const { data: folders, error: foldersError } = await supabase.storage
    .from(BUCKET_NAME)
    .list('prints', { limit: 1000 })

  if (foldersError) {
    throw new Error(`Failed to list folders: ${foldersError.message}`)
  }

  // For each folder, list files
  // Note: folders in Supabase storage have id: null, files have an id
  for (const folder of folders || []) {
    if (!folder.name) continue // Skip empty entries

    const { data: files, error: filesError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`prints/${folder.name}`, { limit: 100 })

    if (filesError) {
      console.warn(`Failed to list files in prints/${folder.name}: ${filesError.message}`)
      continue
    }

    for (const file of files || []) {
      // Skip existing thumbnails and empty entries
      if (!file.name || file.name === 'thumb.webp' || file.name === '.emptyFolderPlaceholder') {
        continue
      }

      images.push({
        folder: folder.name,
        path: `prints/${folder.name}/${file.name}`,
        thumbPath: `prints/${folder.name}/thumb.webp`,
      })
    }
  }

  return images
}

async function generateThumbnail(imageBuffer) {
  return sharp(imageBuffer)
    .resize(THUMB_SIZE, THUMB_SIZE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer()
}

async function processImage(image) {
  const { path, thumbPath, folder } = image

  // Check if thumbnail already exists
  const { data: existing } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`prints/${folder}`, { search: 'thumb.webp' })

  if (existing?.some(f => f.name === 'thumb.webp')) {
    return { status: 'skipped', path, reason: 'thumbnail exists' }
  }

  // Download original image
  const { data: imageData, error: downloadError } = await supabase.storage
    .from(BUCKET_NAME)
    .download(path)

  if (downloadError) {
    return { status: 'error', path, reason: downloadError.message }
  }

  // Generate thumbnail
  const imageBuffer = Buffer.from(await imageData.arrayBuffer())
  const thumbnail = await generateThumbnail(imageBuffer)

  // Upload thumbnail
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(thumbPath, thumbnail, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    })

  if (uploadError) {
    return { status: 'error', path, reason: uploadError.message }
  }

  return {
    status: 'created',
    path,
    thumbPath,
    originalSize: imageBuffer.length,
    thumbSize: thumbnail.length,
  }
}

async function main() {
  console.log('Generating thumbnails for existing artwork images...\n')

  // List all images
  console.log('Listing images...')
  const images = await listAllImages()
  console.log(`Found ${images.length} images\n`)

  if (images.length === 0) {
    console.log('No images to process')
    return
  }

  // Process each image
  const results = {
    created: 0,
    skipped: 0,
    errors: 0,
    totalOriginalSize: 0,
    totalThumbSize: 0,
  }

  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    process.stdout.write(`\r[${i + 1}/${images.length}] Processing ${image.folder}...`)

    try {
      const result = await processImage(image)

      if (result.status === 'created') {
        results.created++
        results.totalOriginalSize += result.originalSize
        results.totalThumbSize += result.thumbSize
      } else if (result.status === 'skipped') {
        results.skipped++
      } else {
        results.errors++
        console.log(`\n  Error: ${result.reason}`)
      }
    } catch (err) {
      results.errors++
      console.log(`\n  Error: ${err.message}`)
    }
  }

  // Summary
  console.log('\n\n--- Summary ---')
  console.log(`Created: ${results.created}`)
  console.log(`Skipped (already exist): ${results.skipped}`)
  console.log(`Errors: ${results.errors}`)

  if (results.created > 0) {
    const savings = ((1 - results.totalThumbSize / results.totalOriginalSize) * 100).toFixed(1)
    console.log(`\nSize reduction: ${(results.totalOriginalSize / 1024 / 1024).toFixed(2)} MB -> ${(results.totalThumbSize / 1024 / 1024).toFixed(2)} MB (${savings}% smaller)`)
  }
}

main().catch(console.error)
