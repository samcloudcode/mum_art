'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { formatPrice, calculateNetAmount } from '@/lib/utils'
import { ChevronRightIcon } from '@/components/ui/icons'

export default function DashboardPage() {
  const { allEditions, distributors, isReady } = useInventory()

  const stats = useMemo(() => {
    const total = allEditions.length
    const sold = allEditions.filter(e => e.is_sold).length
    const printed = allEditions.filter(e => e.is_printed).length
    const inStock = allEditions.filter(e => e.is_printed && !e.is_sold).length
    const totalRevenue = allEditions
      .filter(e => e.is_sold && e.retail_price)
      .reduce((sum, e) => sum + (e.retail_price || 0), 0)
    const unsettledAmount = allEditions
      .filter(e => e.is_sold && !e.is_settled && e.retail_price)
      .reduce((sum, e) => sum + calculateNetAmount(e.retail_price, e.commission_percentage), 0)
    return { total, sold, printed, inStock, totalRevenue, unsettledAmount }
  }, [allEditions])

  // Top galleries by stock
  const topGalleries = useMemo(() => {
    const stockByGallery = new Map<number, { name: string; count: number; sold: number }>()
    allEditions.forEach(e => {
      if (!e.distributor_id || !e.is_printed) return
      const dist = distributors.find(d => d.id === e.distributor_id)
      if (!dist) return
      const current = stockByGallery.get(e.distributor_id) || { name: dist.name, count: 0, sold: 0 }
      if (!e.is_sold) {
        current.count++
      } else {
        current.sold++
      }
      stockByGallery.set(e.distributor_id, current)
    })
    return Array.from(stockByGallery.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
  }, [allEditions, distributors])

  if (!isReady) return null

  return (
    <div className="space-y-12">
      {/* Page header */}
      <header className="border-b border-border pb-8">
        <h1 className="text-foreground mb-2">Collection Overview</h1>
        <p className="text-muted-foreground text-lg font-light">
          {stats.total.toLocaleString()} editions across your collection
        </p>
      </header>

      {/* Key metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="gallery-plaque">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Total Editions
          </p>
          <p className="stat-value text-foreground">{stats.total.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {stats.printed.toLocaleString()} printed
          </p>
        </div>

        <div className="gallery-plaque">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Sold
          </p>
          <p className="stat-value status-sold">{stats.sold.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {stats.total > 0 ? Math.round((stats.sold / stats.total) * 100) : 0}% sell-through
          </p>
        </div>

        <div className="gallery-plaque">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Total Revenue
          </p>
          <p className="stat-value text-foreground">{formatPrice(stats.totalRevenue)}</p>
          <p className="text-sm text-muted-foreground mt-2">
            From {stats.sold.toLocaleString()} sales
          </p>
        </div>

        <div className="gallery-plaque">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Awaiting Payment
          </p>
          <p className="stat-value text-accent">{formatPrice(stats.unsettledAmount)}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Net to artist after commission
          </p>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-foreground mb-6">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/editions?printed=false"
            className="group exhibition-label hover:border-l-accent transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground group-hover:text-accent transition-colors">
                  Record Printing
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {stats.total - stats.printed} unprinted editions
                </p>
              </div>
              <ChevronRightIcon className="text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <Link
            href="/editions?sold=false&printed=true"
            className="group exhibition-label hover:border-l-accent transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground group-hover:text-accent transition-colors">
                  Move Stock
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {stats.inStock} editions in stock
                </p>
              </div>
              <ChevronRightIcon className="text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <Link
            href="/sales"
            className="group exhibition-label hover:border-l-accent transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground group-hover:text-accent transition-colors">
                  View Sales
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">Track payments by month</p>
              </div>
              <ChevronRightIcon className="text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        </div>
      </section>

      {/* Gallery Overview */}
      <section>
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-foreground">Gallery Locations</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Top galleries by stock
            </p>
          </div>
          <Link
            href="/galleries"
            className="text-sm text-muted-foreground hover:text-accent gallery-link transition-colors"
          >
            View all galleries
          </Link>
        </div>

        {topGalleries.length === 0 ? (
          <div className="border border-border rounded-sm p-8 text-center text-muted-foreground">
            <p>No stock assigned to galleries yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topGalleries.map(([id, gallery]) => (
              <Link
                key={id}
                href={`/galleries/${id}`}
                className="group flex items-center justify-between p-4 border border-border rounded-sm hover:border-accent/30 transition-colors"
              >
                <span className="font-medium text-foreground group-hover:text-accent transition-colors">
                  {gallery.name}
                </span>
                <div className="flex items-center gap-6">
                  <span className="text-sm text-muted-foreground">
                    {gallery.count} in stock
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {gallery.sold} sold
                  </span>
                  <ChevronRightIcon className="w-4 h-4 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
