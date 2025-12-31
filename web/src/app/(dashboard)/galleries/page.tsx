'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { useInventory } from '@/lib/hooks/use-inventory'
import { formatPrice, calculateNetAmount } from '@/lib/utils'

export default function GalleriesPage() {
  const { distributors, allEditions, isReady, toggleDistributorFavorite } = useInventory()

  // Sort distributors: favorites first, then alphabetically
  const sortedDistributors = useMemo(() => {
    return [...distributors].sort((a, b) => {
      // Favorites first
      if (a.is_favorite && !b.is_favorite) return -1
      if (!a.is_favorite && b.is_favorite) return 1
      // Then alphabetically by name
      return a.name.localeCompare(b.name)
    })
  }, [distributors])

  // Calculate stats per distributor
  const statsMap = useMemo(() => {
    const map = new Map<number, {
      total: number
      sold: number
      inStock: number
      unsettledCount: number
      unsettledAmount: number
      stockValue: number
    }>()

    allEditions.forEach((edition) => {
      if (!edition.distributor_id) return
      const current = map.get(edition.distributor_id) || {
        total: 0,
        sold: 0,
        inStock: 0,
        unsettledCount: 0,
        unsettledAmount: 0,
        stockValue: 0,
      }
      current.total++
      if (edition.is_sold) {
        current.sold++
        if (!edition.is_settled && edition.retail_price) {
          current.unsettledCount++
          current.unsettledAmount += calculateNetAmount(edition.retail_price, edition.commission_percentage)
        }
      } else if (edition.is_printed) {
        // In stock = printed but not sold
        current.inStock++
        if (edition.retail_price) {
          current.stockValue += edition.retail_price
        }
      }
      map.set(edition.distributor_id, current)
    })
    return map
  }, [allEditions])

  if (!isReady) return null

  return (
    <div className="space-y-10">
      {/* Page header */}
      <header className="border-b border-border pb-8">
        <h1 className="text-foreground mb-2">Gallery Network</h1>
        <p className="text-muted-foreground text-lg font-light">
          {distributors.length} locations displaying your work
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedDistributors.map((dist, index) => {
          const stats = statsMap.get(dist.id) || {
            total: 0,
            sold: 0,
            inStock: 0,
            unsettledCount: 0,
            unsettledAmount: 0,
            stockValue: 0,
          }
          const staggerClass = `stagger-${(index % 4) + 1}`

          return (
            <div
              key={dist.id}
              className={`group gallery-plaque hover:border-accent/30 transition-all duration-300 animate-fade-up opacity-0 ${staggerClass} relative`}
            >
              {/* Favorite toggle button */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleDistributorFavorite(dist.id)
                }}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted/50 transition-colors z-10"
                title={dist.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star
                  className={`w-4 h-4 transition-colors ${
                    dist.is_favorite
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground/40 hover:text-muted-foreground'
                  }`}
                />
              </button>

              <Link href={`/galleries/${dist.id}`} className="block">
                {/* Header with name and status */}
                <div className="flex items-start justify-between mb-4 pr-8">
                  <div>
                    <h3 className="font-serif text-lg text-foreground group-hover:text-accent transition-colors">
                      {dist.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {dist.commission_percentage !== null
                        ? `${dist.commission_percentage}% commission`
                        : 'Direct sales'}
                    </p>
                  </div>
                  {stats.unsettledAmount > 0 && (
                    <span className="text-xs px-2 py-1 bg-accent/10 text-accent rounded-sm font-medium">
                      {formatPrice(stats.unsettledAmount)} due
                    </span>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div>
                    <p className="stat-value-sm text-foreground/70">{stats.inStock}</p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                      In Stock
                    </p>
                  </div>
                  <div>
                    <p className="stat-value-sm status-sold">{stats.sold}</p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                      Sold
                    </p>
                  </div>
                  <div>
                    <p className="stat-value-sm text-foreground">{stats.total}</p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                      Total
                    </p>
                  </div>
                </div>

                {/* Stock value */}
                {stats.stockValue > 0 && (
                  <div className="pt-4 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        Stock value
                      </span>
                      <span className="font-mono text-sm text-foreground">
                        {formatPrice(stats.stockValue)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Contact info */}
                {dist.contact_number && (
                  <p className="text-xs text-muted-foreground mt-3 truncate">
                    {dist.contact_number}
                  </p>
                )}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
