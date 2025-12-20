'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getImageUrl, getThumbnailUrl } from '@/lib/supabase/storage'
import { ImageUpload } from './image-upload'
import { Button } from '@/components/ui/button'

interface ArtworkImageSectionProps {
  printId: number
  printName: string
  initialImagePath: string | null
}

export function ArtworkImageSection({
  printId,
  printName,
  initialImagePath,
}: ArtworkImageSectionProps) {
  const [imagePath, setImagePath] = useState(initialImagePath)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const supabase = createClient()

  const handleUploadComplete = async (path: string) => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('prints')
        .update({ primary_image_path: path })
        .eq('id', printId)

      if (error) throw error

      setImagePath(path)
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save image path:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const imageUrl = getImageUrl(imagePath)
  const thumbnailUrl = getThumbnailUrl(imagePath, { width: 600, height: 600 })

  if (isEditing) {
    return (
      <div className="space-y-4">
        <ImageUpload
          printId={printId}
          currentImagePath={imagePath}
          onUploadComplete={handleUploadComplete}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          {isSaving && (
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-square max-w-md overflow-hidden rounded-lg bg-muted border">
        {thumbnailUrl ? (
          <a href={imageUrl || '#'} target="_blank" rel="noopener noreferrer">
            <Image
              src={thumbnailUrl}
              alt={printName}
              fill
              className="object-cover hover:opacity-90 transition-opacity"
              sizes="(max-width: 768px) 100vw, 400px"
              priority
            />
          </a>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <svg
              className="h-20 w-20 mb-2 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">No image uploaded</p>
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
        {imagePath ? 'Change Image' : 'Upload Image'}
      </Button>
    </div>
  )
}
