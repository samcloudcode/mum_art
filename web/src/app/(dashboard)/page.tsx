'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { formatPrice, calculateNetAmount } from '@/lib/utils'
import { ChevronRightIcon } from '@/components/ui/icons'
import {
  generateInventoryAlerts,
  calculateYearOverYear,
  calculateRollingMetrics,
  calculateArtworkStats,
  getTrendIndicator,
  formatPercentChange,
} from '@/lib/utils/analytics'
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

  // Alerts for "Needs Attention" section
  const alerts = useMemo(
    () => generateInventoryAlerts(allEditions, prints, distributors).slice(0, 3),
    [allEditions, prints, distributors]
  )

  // Year-over-year comparison for trend indicators (calendar year)
  const yoyComparison = useMemo(
    () => calculateYearOverYear(allEditions),
    [allEditions]
  )

  // Rolling 12-month metrics for more accurate YoY
  const rollingMetrics = useMemo(
    () => calculateRollingMetrics(allEditions),
    [allEditions]
  )

  // Top selling artworks (last 12 months)
  const topSellers = useMemo(() => {
    const artworkStats = calculateArtworkStats(allEditions, prints, distributors)
    return artworkStats
      .filter(a => a.velocityLast12Months > 0)
      .sort((a, b) => b.velocityLast12Months - a.velocityLast12Months)
      .slice(0, 5)
  }, [allEditions, prints, distributors])

  // Last sale date
  const lastSaleDate = useMemo(() => {
    const soldEditions = allEditions
      .filter(e => e.is_sold && e.date_sold && e.status_confidence !== 'legacy_unknown')
      .sort((a, b) => new Date(b.date_sold!).getTime() - new Date(a.date_sold!).getTime())

    if (soldEditions.length === 0) return null

    const lastSale = new Date(soldEditions[0].date_sold!)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - lastSale.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
  }, [allEditions])

  if (!isReady) return null

  return (
    <div className="space-y-12">
      {/* Page header */}
      <header className="border-b border-border pb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-foreground mb-2">Collection Overview</h1>
            <p className="text-muted-foreground text-lg font-light">
              {stats.artworkCount} original designs in your portfolio
            </p>
          </div>
          {lastSaleDate && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Last Sale</p>
              <p className="text-sm text-foreground mt-1">{lastSaleDate}</p>
            </div>
          )}
        </div>
      </header>

      {/* Key metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="gallery-plaque">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            In Stock
          </p>
          <p className="stat-value text-foreground">{stats.inStock.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {stats.printed.toLocaleString()} printed across {stats.artworkCount} designs
          </p>
        </div>

        <div className="gallery-plaque">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Sold
            {rollingMetrics.yoyChangePercent !== 0 && (
              <span className={`ml-2 text-xs ${rollingMetrics.yoyChangePercent > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {getTrendIndicator(rollingMetrics.yoyChangePercent)} {formatPercentChange(rollingMetrics.yoyChangePercent)} YoY
              </span>
            )}
          </p>
          <p className="stat-value status-sold">{stats.sold.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {stats.sellThrough}% sell-through rate
          </p>
        </div>

        <div className="gallery-plaque">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Net Revenue
            <span className="font-normal text-muted-foreground/70 ml-1">(past 12m)</span>
          </p>
          <p className="stat-value text-foreground">{formatPrice(rollingMetrics.rolling12MonthNetRevenue)}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {formatPrice(stats.netRevenue)} all time
          </p>
        </div>

        <Link href="/sales?settled=false" className="gallery-plaque hover:border-accent/50 transition-colors">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Awaiting Payment
          </p>
          <p className="stat-value text-accent">{formatPrice(stats.unsettledAmount)}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {stats.unsettledCount} sales pending →
          </p>
        </Link>
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

      {/* Top Sellers */}
      {topSellers.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-foreground">Top Sellers</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Best performing artworks in the last 12 months
              </p>
            </div>
            <Link
              href="/artworks"
              className="text-sm text-muted-foreground hover:text-accent gallery-link transition-colors"
            >
              View all artworks
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topSellers.map((artwork) => (
              <Link
                key={artwork.printId}
                href={`/artworks/${artwork.printId}`}
                className="group flex items-center justify-between p-4 border border-border rounded-sm hover:border-accent/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground group-hover:text-accent transition-colors truncate">
                    {artwork.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {artwork.remaining} remaining · {artwork.sellThroughRate.toFixed(0)}% sold
                  </p>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p className="text-lg font-medium text-foreground">{artwork.velocityLast12Months}</p>
                  <p className="text-xs text-muted-foreground">sold</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

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

      {/* Needs Attention */}
      {alerts.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-foreground">Needs Attention</h2>
            <Link
              href="/analytics"
              className="text-sm text-muted-foreground hover:text-accent gallery-link transition-colors"
            >
              View all insights
            </Link>
          </div>
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`p-4 rounded-sm border-l-4 ${
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-500 dark:bg-red-950/30'
                    : alert.severity === 'warning'
                    ? 'bg-amber-50 border-amber-500 dark:bg-amber-950/30'
                    : 'bg-blue-50 border-blue-500 dark:bg-blue-950/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{alert.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                  </div>
                  {(alert.artworkId || alert.galleryId) && (
                    <Link
                      href={alert.artworkId ? `/artworks/${alert.artworkId}` : `/galleries/${alert.galleryId}`}
                      className="text-sm text-muted-foreground hover:text-accent shrink-0 ml-4"
                    >
                      View →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
