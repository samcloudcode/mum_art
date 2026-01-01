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
                ? 'bg-accent/10 text-accent'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isPrinted ? 'bg-accent' : 'bg-muted-foreground/50'
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
                  ? 'bg-seafoam/10 text-seafoam'
                  : 'bg-coral/10 text-coral'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isSettled ? 'bg-seafoam' : 'bg-coral'
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

