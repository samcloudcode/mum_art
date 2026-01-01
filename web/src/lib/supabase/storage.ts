const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const BUCKET_NAME = 'artwork-images'

// Cache for 1 year (images rarely change)
const CACHE_CONTROL = '31536000'

// Thumbnail settings
const THUMB_SIZE = 400
const THUMB_QUALITY = 0.85

/**
 * Get the public URL for an image in the artwork-images bucket
 */
export function getImageUrl(path: string | null): string | null {
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${path}`
}

/**
 * Get the thumbnail URL for a given image path
 * Returns the pre-generated thumbnail path (stored alongside original)
 */
export function getThumbnailUrl(path: string | null): string | null {
  if (!path) return null

  // Convert original path to thumbnail path
  // e.g., "prints/recXYZ/image.jpg" -> "prints/recXYZ/thumb.webp"
  const thumbPath = path.replace(/\/[^/]+$/, '/thumb.webp')

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${thumbPath}`
}

/**
 * Generate the storage path for a print's image
 * Uses airtable_id (stable across imports) instead of database id
 */
export function getPrintImagePath(airtableId: string, filename: string): string {
  // Sanitize filename and preserve extension
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
  const sanitizedName = filename
    .replace(/\.[^.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace special chars
    .substring(0, 50) // Limit length

  return `prints/${airtableId}/${sanitizedName}.${ext}`
}

/**
 * Generate a thumbnail from an image file using Canvas API
 * Returns a WebP blob for optimal size/quality
 */
async function generateThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // Calculate dimensions maintaining aspect ratio
      let width = img.width
      let height = img.height

      if (width > height) {
        if (width > THUMB_SIZE) {
          height = Math.round((height * THUMB_SIZE) / width)
          width = THUMB_SIZE
        }
      } else {
        if (height > THUMB_SIZE) {
          width = Math.round((width * THUMB_SIZE) / height)
          height = THUMB_SIZE
        }
      }

      // Draw to canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // Use high-quality image smoothing
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      // Convert to WebP blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to generate thumbnail blob'))
          }
        },
        'image/webp',
        THUMB_QUALITY
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Upload an image to the artwork-images bucket
 * Also generates and uploads a thumbnail for faster loading
 * Returns the original image path on success
 */
export async function uploadArtworkImage(
  supabase: ReturnType<typeof import('./client').createClient>,
  airtableId: string,
  file: File
): Promise<string> {
  const originalPath = getPrintImagePath(airtableId, file.name)
  const thumbPath = `prints/${airtableId}/thumb.webp`

  // Generate thumbnail
  const thumbnail = await generateThumbnail(file)

  // Upload both original and thumbnail in parallel
  const [originalResult, thumbResult] = await Promise.all([
    supabase.storage.from(BUCKET_NAME).upload(originalPath, file, {
      cacheControl: CACHE_CONTROL,
      upsert: true,
    }),
    supabase.storage.from(BUCKET_NAME).upload(thumbPath, thumbnail, {
      cacheControl: CACHE_CONTROL,
      upsert: true,
      contentType: 'image/webp',
    }),
  ])

  if (originalResult.error) {
    throw new Error(`Failed to upload image: ${originalResult.error.message}`)
  }

  if (thumbResult.error) {
    // Log but don't fail - original still uploaded
    console.warn(`Failed to upload thumbnail: ${thumbResult.error.message}`)
  }

  return originalPath
}

/**
 * Delete an image and its thumbnail from the artwork-images bucket
 */
export async function deleteArtworkImage(
  supabase: ReturnType<typeof import('./client').createClient>,
  path: string
): Promise<void> {
  const thumbPath = path.replace(/\/[^/]+$/, '/thumb.webp')

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path, thumbPath])

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`)
  }
}
