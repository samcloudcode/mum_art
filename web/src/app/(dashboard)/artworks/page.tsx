'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useInventory } from '@/lib/hooks/use-inventory'
import { getThumbnailUrl } from '@/lib/supabase/storage'
import { ImagePlaceholderIcon, SearchIcon, ExternalLinkIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { Print } from '@/lib/types'

type LocationStock = {
  name: string
  count: number
}

type PrintStats = {
  total: number
  printed: number
  sold: number
  inStock: number
  unsettled: number
  locationStock: LocationStock[]
}

export default function ArtworksPage() {
  const { prints, allEditions, isReady } = useInventory()
  const [searchQuery, setSearchQuery] = useState('')

  // Calculate stats per print including location breakdown
  const statsMap = useMemo(() => {
    const map = new Map<number, PrintStats>()
    allEditions.forEach((edition) => {
      const current = map.get(edition.print_id) || {
        total: 0,
        printed: 0,
        sold: 0,
        inStock: 0,
        unsettled: 0,
        locationStock: [],
      }
      current.total++
      if (edition.is_printed) current.printed++
      if (edition.is_sold) {
        current.sold++
        if (!edition.is_settled) current.unsettled++
      }
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

  // Filter prints based on search query
  const filteredPrints = useMemo(() => {
    if (!searchQuery.trim()) return prints
    const query = searchQuery.toLowerCase()
    return prints.filter((print) => {
      const stats = statsMap.get(print.id)
      // Search in name
      if (print.name.toLowerCase().includes(query)) return true
      // Search in description
      if (print.description?.toLowerCase().includes(query)) return true
      // Search in location names
      if (stats?.locationStock.some(loc => loc.name.toLowerCase().includes(query))) return true
      return false
    })
  }, [prints, searchQuery, statsMap])

  if (!isReady) return null

  return (
    <div className="space-y-8">
      {/* Page header with search */}
      <header className="border-b border-border pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-foreground mb-1">Artwork Collection</h1>
            <p className="text-muted-foreground font-light">
              {filteredPrints.length} of {prints.length} original designs
            </p>
          </div>

          {/* Search input */}
          <div className="relative w-full sm:w-80">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search artworks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card"
            />
          </div>
        </div>
      </header>

      {/* Artwork list */}
      <div className="space-y-4">
        {filteredPrints.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-serif">No artworks found</p>
            <p className="text-sm mt-1">Try adjusting your search terms</p>
          </div>
        ) : (
          filteredPrints.map((print, index) => (
            <ArtworkListItem
              key={print.id}
              print={print}
              stats={statsMap.get(print.id) || {
                total: 0,
                printed: 0,
                sold: 0,
                inStock: 0,
                unsettled: 0,
                locationStock: [],
              }}
              index={index}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ArtworkListItem({
  print,
  stats,
  index,
}: {
  print: Print
  stats: PrintStats
  index: number
}) {
  const sellThrough = stats.total > 0 ? Math.round((stats.sold / stats.total) * 100) : 0
  const staggerClass = `stagger-${(index % 4) + 1}`

  // Calculate percentages for progress bar
  const soldPct = stats.total > 0 ? (stats.sold / stats.total) * 100 : 0
  const inStockPct = stats.total > 0 ? (stats.inStock / stats.total) * 100 : 0

  return (
    <Link
      href={`/artworks/${print.id}`}
      className={`group block gallery-plaque hover:border-accent/40 transition-all duration-300 animate-fade-up opacity-0 ${staggerClass}`}
    >
      <div className="flex gap-6">
        {/* Image on the left */}
        <div className="relative w-32 h-40 sm:w-40 sm:h-52 flex-shrink-0 overflow-hidden rounded-sm bg-muted">
          {print.primary_image_path ? (
            <Image
              src={getThumbnailUrl(print.primary_image_path, { width: 200, height: 260, resize: 'contain' }) || ''}
              alt={print.name}
              fill
              className="object-contain transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 128px, 160px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImagePlaceholderIcon className="text-muted-foreground/30 w-12 h-12" />
            </div>
          )}
        </div>

        {/* Details on the right */}
        <div className="flex-1 min-w-0 py-1">
          {/* Title and edition info */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              <h3 className="font-serif text-xl text-foreground group-hover:text-accent transition-colors truncate">
                {print.name}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {print.total_editions ? `Edition of ${print.total_editions}` : 'Open edition'}
              </p>
            </div>

            {/* Web link indicator */}
            {print.web_link && (
              <span className="flex-shrink-0 text-muted-foreground/50 group-hover:text-accent/70 transition-colors">
                <ExternalLinkIcon className="w-4 h-4" />
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
            <div className="flex items-baseline gap-1.5">
              <span className="stat-value-sm text-foreground">{stats.sold}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">sold</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="stat-value-sm text-foreground/70">{stats.inStock}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">in stock</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="stat-value-sm text-muted-foreground/60">{stats.total - stats.printed}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">unprinted</span>
            </div>
            {stats.unsettled > 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className="stat-value-sm text-coral">{stats.unsettled}</span>
                <span className="text-xs uppercase tracking-wider text-coral/70">unsettled</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span className="uppercase tracking-wider">Progress</span>
              <span className="font-mono">{sellThrough}% sold</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
              {soldPct > 0 && (
                <div
                  className="h-full bg-seafoam transition-all duration-500"
                  style={{ width: `${soldPct}%` }}
                />
              )}
              {inStockPct > 0 && (
                <div
                  className="h-full bg-accent transition-all duration-500"
                  style={{ width: `${inStockPct}%` }}
                />
              )}
            </div>
          </div>

          {/* Location tags */}
          {stats.inStock > 0 && stats.locationStock.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {stats.locationStock.slice(0, 4).map((loc) => (
                <span
                  key={loc.name}
                  className="text-xs px-2 py-1 bg-accent/10 text-accent/80 rounded-sm"
                >
                  {loc.name} ({loc.count})
                </span>
              ))}
              {stats.locationStock.length > 4 && (
                <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-sm">
                  +{stats.locationStock.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Status badges */}
          {sellThrough >= 90 && (
            <div className="mt-3">
              <span className="text-xs px-2 py-1 bg-gold/20 text-gold rounded-sm font-medium">
                Nearly sold out
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
