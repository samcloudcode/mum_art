'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn, formatPrice } from '@/lib/utils'
import type { EditionWithRelations } from '@/lib/types'

type Props = {
  edition: EditionWithRelations
  showLocation?: boolean
  showPrice?: boolean
  showStatus?: boolean
  className?: string
}

export const MobileEditionCard = memo(function MobileEditionCard({
  edition,
  showLocation = true,
  showPrice = true,
  showStatus = true,
  className,
}: Props) {
  const isPrinted = edition.is_printed
  const isSold = edition.is_sold
  const isSettled = edition.is_settled

  return (
    <Link
      href={`/editions/${edition.id}`}
      className={cn(
        'block p-4 bg-card border border-border rounded-lg',
        'active:bg-secondary/50 transition-colors',
        'touch-manipulation',
        className
      )}
    >
      {/* Top row: Edition number + Artwork name */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-serif text-lg font-medium text-foreground">
            {edition.edition_display_name}
          </p>
          {edition.prints && (
            <p className="text-sm text-muted-foreground truncate">
              {edition.prints.name}
            </p>
          )}
        </div>
        {showPrice && edition.retail_price && (
          <span className="font-mono text-sm text-foreground whitespace-nowrap">
            {formatPrice(edition.retail_price)}
          </span>
        )}
      </div>

      {/* Middle row: Size, Frame, Location */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {edition.size && (
          <Badge variant="outline" className="text-xs">
            {edition.size}
          </Badge>
        )}
        {edition.frame_type && (
          <Badge variant="outline" className="text-xs">
            {edition.frame_type}
          </Badge>
        )}
        {showLocation && edition.distributors && (
          <span className="text-xs text-muted-foreground">
            @ {edition.distributors.name}
          </span>
        )}
      </div>

      {/* Bottom row: Status badges */}
      {showStatus && (
        <div className="flex items-center gap-2">
          {/* Printed status */}
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
              isPrinted
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500'
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isPrinted ? 'bg-blue-500' : 'bg-gray-400'
              )}
            />
            {isPrinted ? 'Printed' : 'Not Printed'}
          </span>

          {/* Sale status */}
          {isSold ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                isSettled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isSettled ? 'bg-green-500' : 'bg-amber-500'
                )}
              />
              {isSettled ? 'Sold & Settled' : 'Sold (Unpaid)'}
            </span>
          ) : (
            isPrinted && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-foreground/50" />
                Available
              </span>
            )
          )}
        </div>
      )}
    </Link>
  )
})

// Compact variant for lists with many items
export const MobileEditionCardCompact = memo(function MobileEditionCardCompact({
  edition,
  showPrice = true,
  className,
}: {
  edition: EditionWithRelations
  showPrice?: boolean
  className?: string
}) {
  return (
    <Link
      href={`/editions/${edition.id}`}
      className={cn(
        'flex items-center justify-between p-3 bg-card border border-border rounded-lg',
        'active:bg-secondary/50 transition-colors',
        'touch-manipulation',
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Edition number - prominent */}
        <span className="font-mono text-sm font-medium text-foreground whitespace-nowrap">
          {edition.edition_number}/{edition.prints?.total_editions || '?'}
        </span>

        {/* Artwork name */}
        <span className="text-sm text-muted-foreground truncate">
          {edition.prints?.name}
        </span>
      </div>

      <div className="flex items-center gap-2 ml-2">
        {/* Size badge */}
        {edition.size && (
          <Badge variant="outline" className="text-xs hidden sm:inline-flex">
            {edition.size}
          </Badge>
        )}

        {/* Price */}
        {showPrice && edition.retail_price && (
          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
            {formatPrice(edition.retail_price)}
          </span>
        )}
      </div>
    </Link>
  )
})
