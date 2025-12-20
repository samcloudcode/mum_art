const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const BUCKET_NAME = 'artwork-images'

/**
 * Get the public URL for an image in the artwork-images bucket
 */
export function getImageUrl(path: string | null): string | null {
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${path}`
}

/**
 * Get a transformed image URL with resizing (requires Supabase Pro)
 * Uses Supabase's on-the-fly image transformation
 */
export function getThumbnailUrl(
  path: string | null,
  options: {
    width?: number
    height?: number
    resize?: 'cover' | 'contain' | 'fill'
    quality?: number
  } = {}
): string | null {
  if (!path) return null

  const { width = 300, height = 300, resize = 'cover', quality = 80 } = options

  const params = new URLSearchParams({
    width: width.toString(),
    height: height.toString(),
    resize,
    quality: quality.toString(),
  })

  return `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET_NAME}/${path}?${params}`
}

/**
 * Generate the storage path for a print's image
 */
export function getPrintImagePath(printId: number, filename: string): string {
  // Sanitize filename and preserve extension
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
  const sanitizedName = filename
    .replace(/\.[^.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace special chars
    .substring(0, 50) // Limit length

  return `prints/${printId}/${sanitizedName}.${ext}`
}

/**
 * Upload an image to the artwork-images bucket
 * Returns the path on success, or throws on error
 */
export async function uploadArtworkImage(
  supabase: ReturnType<typeof import('./client').createClient>,
  printId: number,
  file: File
): Promise<string> {
  const path = getPrintImagePath(printId, file.name)

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true, // Overwrite if exists
    })

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`)
  }

  return path
}

/**
 * Delete an image from the artwork-images bucket
 */
export async function deleteArtworkImage(
  supabase: ReturnType<typeof import('./client').createClient>,
  path: string
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path])

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`)
  }
}
