'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getImageUrl, getThumbnailUrl } from '@/lib/supabase/storage'

interface ArtworkImageProps {
  imagePath: string
  alt: string
  fill?: boolean
  className?: string
  sizes?: string
}

export function ArtworkImage({ imagePath, alt, fill, className, sizes }: ArtworkImageProps) {
  const [useFallback, setUseFallback] = useState(false)

  const imageUrl = getImageUrl(imagePath)
  const thumbnailUrl = getThumbnailUrl(imagePath)
  const displayUrl = useFallback ? imageUrl : thumbnailUrl

  if (!displayUrl) return null

  return (
    <Image
      src={displayUrl}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      onError={() => {
        if (!useFallback && imageUrl) {
          setUseFallback(true)
        }
      }}
    />
  )
}
