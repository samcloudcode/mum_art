'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useInventory } from '@/lib/hooks/use-inventory'
import { getThumbnailUrl } from '@/lib/supabase/storage'
import { ImagePlaceholderIcon } from '@/components/ui/icons'

type LocationStock = {
  name: string
  count: number
}

type PrintStats = {
  total: number
  printed: number
  sold: number
  inStock: number // printed but not sold
  locationStock: LocationStock[]
}

export default function ArtworksPage() {
  const { prints, allEditions, isReady } = useInventory()

  // Calculate stats per print including location breakdown
  const statsMap = useMemo(() => {
    const map = new Map<number, PrintStats>()
    allEditions.forEach((edition) => {
      const current = map.get(edition.print_id) || {
        total: 0,
        printed: 0,
        sold: 0,
        inStock: 0,
        locationStock: [],
      }
      current.total++
      if (edition.is_printed) current.printed++
      if (edition.is_sold) current.sold++
      // Track printed but unsold (in stock) by location
      if (edition.is_printed && !edition.is_sold) {
        current.inStock++
        const locName = edition.distributors?.name || 'Direct'
        const existingLoc = current.locationStock.find((l) => l.name === locName)
        if (existingLoc) {
          existingLoc.count++
        } else {
          current.locationStock.push({ name: locName, count: 1 })
        }
      }
      map.set(edition.print_id, current)
    })
    // Sort location stock by count descending
    map.forEach((stats) => {
      stats.locationStock.sort((a, b) => b.count - a.count)
    })
    return map
  }, [allEditions])

  if (!isReady) return null

  return (
    <div className="space-y-10">
      {/* Page header */}
      <header className="border-b border-border pb-8">
        <h1 className="text-foreground mb-2">Artwork Collection</h1>
        <p className="text-muted-foreground text-lg font-light">
          {prints.length} original designs in your portfolio
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {prints.map((print, index) => {
          const stats = statsMap.get(print.id) || {
            total: 0,
            printed: 0,
            sold: 0,
            inStock: 0,
            locationStock: [],
          }
          const unprinted = stats.total - stats.printed
          const sellThrough = stats.total > 0 ? Math.round((stats.sold / stats.total) * 100) : 0
          const staggerClass = `stagger-${(index % 4) + 1}`

          // Calculate percentages for stacked bar
          const soldPct = stats.total > 0 ? (stats.sold / stats.total) * 100 : 0
          const inStockPct = stats.total > 0 ? (stats.inStock / stats.total) * 100 : 0
          const unprintedPct = stats.total > 0 ? (unprinted / stats.total) * 100 : 0

          return (
            <Link
              key={print.id}
              href={`/artworks/${print.id}`}
              className={`group gallery-plaque hover:border-accent/30 transition-all duration-300 animate-fade-up opacity-0 ${staggerClass}`}
            >
              {/* Artwork thumbnail - portrait aspect ratio (3:4) */}
              <div className="relative aspect-[3/4] mb-4 -mx-6 -mt-6 overflow-hidden rounded-t-sm bg-muted">
                {print.primary_image_path ? (
                  <Image
                    src={getThumbnailUrl(print.primary_image_path, { width: 400, height: 533, resize: 'contain' }) || ''}
                    alt={print.name}
                    fill
                    className="object-contain transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImagePlaceholderIcon className="text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Artwork title */}
              <h3 className="font-serif text-lg text-foreground group-hover:text-accent transition-colors mb-1">
                {print.name}
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                {print.total_editions ? `Edition of ${print.total_editions}` : 'Open edition'}
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div>
                  <p className="stat-value-sm text-foreground">{stats.total}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                    Editions
                  </p>
                </div>
                <div>
                  <p className="stat-value-sm status-sold">{stats.sold}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                    Sold
                  </p>
                </div>
                <div>
                  <p className="stat-value-sm text-foreground/70">{stats.inStock}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                    In Stock
                  </p>
                </div>
              </div>

              {/* Stacked bar chart: Sold | In Stock | Unprinted */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span className="uppercase tracking-wider">Edition Status</span>
                  <span className="font-mono">{sellThrough}% sold</span>
                </div>
                <div className="h-2 bg-muted rounded-sm overflow-hidden flex">
                  {soldPct > 0 && (
                    <div
                      className="h-full bg-seafoam transition-all duration-500"
                      style={{ width: `${soldPct}%` }}
                      title={`${stats.sold} sold`}
                    />
                  )}
                  {inStockPct > 0 && (
                    <div
                      className="h-full bg-accent transition-all duration-500"
                      style={{ width: `${inStockPct}%` }}
                      title={`${stats.inStock} in stock`}
                    />
                  )}
                  {unprintedPct > 0 && (
                    <div
                      className="h-full bg-muted-foreground/20 transition-all duration-500"
                      style={{ width: `${unprintedPct}%` }}
                      title={`${unprinted} unprinted`}
                    />
                  )}
                </div>
                {/* Legend */}
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-seafoam" />
                    Sold
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-accent" />
                    In Stock
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-muted-foreground/20" />
                    Unprinted
                  </span>
                </div>
              </div>

              {/* Location summary for printed stock */}
              {stats.inStock > 0 && stats.locationStock.length > 0 && (
                <div className="text-xs text-muted-foreground border-t border-border pt-3">
                  <span className="uppercase tracking-wider block mb-1">Stock locations:</span>
                  <div className="flex gap-2 flex-wrap">
                    {stats.locationStock.slice(0, 3).map((loc) => (
                      <span key={loc.name} className="px-2 py-0.5 bg-accent/10 text-accent rounded-sm">
                        {loc.name}: {loc.count}
                      </span>
                    ))}
                    {stats.locationStock.length > 3 && (
                      <span className="px-2 py-0.5 bg-muted rounded-sm">
                        +{stats.locationStock.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Status indicators */}
              <div className="flex gap-2 flex-wrap mt-3">
                {sellThrough >= 90 && (
                  <span className="text-xs px-2 py-1 bg-gold/20 text-gold rounded-sm">
                    Nearly sold out
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
