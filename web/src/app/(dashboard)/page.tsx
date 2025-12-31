'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { formatPrice, calculateNetAmount } from '@/lib/utils'
import { ChevronRightIcon } from '@/components/ui/icons'
import type { EditionWithRelations } from '@/lib/types'

export default function DashboardPage() {
  const { allEditions, prints, distributors, isReady } = useInventory()

  const stats = useMemo(() => {
    // Exclude legacy_unknown editions from stats to avoid skewing numbers
    const verifiedEditions = allEditions.filter(e => e.status_confidence !== 'legacy_unknown')
    const artworkCount = prints.length
    const sold = verifiedEditions.filter(e => e.is_sold).length
    const printed = verifiedEditions.filter(e => e.is_printed).length
    const inStock = verifiedEditions.filter(e => e.is_printed && !e.is_sold).length
    const unsettledCount = verifiedEditions.filter(e => e.is_sold && !e.is_settled).length
    // Net revenue = revenue after commission
    const netRevenue = verifiedEditions
      .filter(e => e.is_sold && e.retail_price)
      .reduce((sum, e) => sum + calculateNetAmount(e.retail_price, e.commission_percentage), 0)
    const unsettledAmount = verifiedEditions
      .filter(e => e.is_sold && !e.is_settled && e.retail_price)
      .reduce((sum, e) => sum + calculateNetAmount(e.retail_price, e.commission_percentage), 0)
    // Sell-through = sold / printed (not sold / total)
    const sellThrough = printed > 0 ? Math.round((sold / printed) * 100) : 0
    // Count legacy items separately
    const legacyCount = allEditions.filter(e => e.status_confidence === 'legacy_unknown').length
    return { artworkCount, sold, printed, inStock, unsettledCount, netRevenue, unsettledAmount, sellThrough, legacyCount }
  }, [allEditions, prints])

  // Performance stats by time period
  const performanceStats = useMemo(() => {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1)
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

    // Exclude legacy_unknown editions from performance stats
    const soldEditions = allEditions.filter(e => e.is_sold && e.date_sold && e.status_confidence !== 'legacy_unknown')

    const inRange = (dateStr: string, start: Date, end: Date) => {
      const d = new Date(dateStr)
      return d >= start && d <= end
    }

    const calcStats = (editions: EditionWithRelations[]) => ({
      count: editions.length,
      revenue: editions.reduce((sum, e) => sum + calculateNetAmount(e.retail_price, e.commission_percentage), 0)
    })

    return {
      ytd: calcStats(soldEditions.filter(e => inRange(e.date_sold!, startOfYear, now))),
      lastYear: calcStats(soldEditions.filter(e => inRange(e.date_sold!, lastYearStart, lastYearEnd))),
      last30Days: calcStats(soldEditions.filter(e => inRange(e.date_sold!, thirtyDaysAgo, now))),
      last12Months: calcStats(soldEditions.filter(e => inRange(e.date_sold!, twelveMonthsAgo, now))),
    }
  }, [allEditions])

  // Enhanced gallery stats
  const galleryStats = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

    const stats = new Map<number, {
      name: string
      commission: number | null
      stock: number
      salesLast30: number
      salesLast12M: number
      hasUnsettled: boolean
    }>()

    // Exclude legacy_unknown editions from gallery stats
    const verifiedEditions = allEditions.filter(e => e.status_confidence !== 'legacy_unknown')

    verifiedEditions.forEach(e => {
      if (!e.distributor_id) return
      const dist = distributors.find(d => d.id === e.distributor_id)
      if (!dist) return

      const current = stats.get(e.distributor_id) || {
        name: dist.name,
        commission: dist.commission_percentage,
        stock: 0,
        salesLast30: 0,
        salesLast12M: 0,
        hasUnsettled: false
      }

      if (e.is_printed && !e.is_sold) current.stock++
      if (e.is_sold && e.date_sold) {
        const saleDate = new Date(e.date_sold)
        if (saleDate >= thirtyDaysAgo) current.salesLast30++
        if (saleDate >= twelveMonthsAgo) current.salesLast12M++
      }
      if (e.is_sold && !e.is_settled) current.hasUnsettled = true

      stats.set(e.distributor_id, current)
    })

    // Filter: only galleries with stock OR any sales history
    return Array.from(stats.entries())
      .filter(([_, g]) => g.stock > 0 || g.salesLast12M > 0)
      .sort((a, b) => b[1].stock - a[1].stock)
  }, [allEditions, distributors])

  if (!isReady) return null

  return (
    <div className="space-y-12">
      {/* Page header */}
      <header className="border-b border-border pb-8">
        <h1 className="text-foreground mb-2">Collection Overview</h1>
        <p className="text-muted-foreground text-lg font-light">
          {stats.artworkCount} original designs in your portfolio
        </p>
      </header>

      {/* Key metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="gallery-plaque">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Artworks
          </p>
          <p className="stat-value text-foreground">{stats.artworkCount}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {stats.printed.toLocaleString()} editions printed
          </p>
        </div>

        <div className="gallery-plaque">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Sold
          </p>
          <p className="stat-value status-sold">{stats.sold.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {stats.sellThrough}% of printed
          </p>
        </div>

        <div className="gallery-plaque">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Net Revenue
          </p>
          <p className="stat-value text-foreground">{formatPrice(stats.netRevenue)}</p>
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
            {stats.unsettledCount} sales pending
          </p>
        </div>
      </section>

      {/* Performance Stats */}
      <section>
        <h2 className="text-foreground mb-6">Sales Performance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Year to Date
            </p>
            <p className="stat-value text-foreground">{performanceStats.ytd.count}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatPrice(performanceStats.ytd.revenue)} revenue
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              {new Date().getFullYear() - 1}
            </p>
            <p className="stat-value text-foreground">{performanceStats.lastYear.count}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatPrice(performanceStats.lastYear.revenue)} revenue
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Last 30 Days
            </p>
            <p className="stat-value text-foreground">{performanceStats.last30Days.count}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatPrice(performanceStats.last30Days.revenue)} revenue
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Last 12 Months
            </p>
            <p className="stat-value text-foreground">{performanceStats.last12Months.count}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatPrice(performanceStats.last12Months.revenue)} revenue
            </p>
          </div>
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
                  {allEditions.length - stats.printed} unprinted editions
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
              Galleries with stock or recent sales
            </p>
          </div>
          <Link
            href="/galleries"
            className="text-sm text-muted-foreground hover:text-accent gallery-link transition-colors"
          >
            View all galleries
          </Link>
        </div>

        {galleryStats.length === 0 ? (
          <div className="border border-border rounded-sm p-8 text-center text-muted-foreground">
            <p>No stock assigned to galleries yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {galleryStats.map(([id, gallery]) => (
              <Link
                key={id}
                href={`/galleries/${id}`}
                className="group flex items-center justify-between p-4 border border-border rounded-sm hover:border-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-foreground group-hover:text-accent transition-colors">
                    {gallery.name}
                  </span>
                  {gallery.commission !== null && (
                    <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                      {gallery.commission}%
                    </span>
                  )}
                  {gallery.hasUnsettled && (
                    <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded">
                      Unsettled
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span>{gallery.stock} in stock</span>
                  <span>{gallery.salesLast30} sold (30d)</span>
                  <span>{gallery.salesLast12M} sold (12m)</span>
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
