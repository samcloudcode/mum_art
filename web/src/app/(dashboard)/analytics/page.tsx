'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { formatPrice } from '@/lib/utils'
import {
  calculatePortfolioHealth,
  calculateArtworkStats,
  calculateGalleryStats,
  calculateYearOverYear,
  calculateRollingMetrics,
  generateInventoryAlerts,
  buildGalleryArtworkMatrix,
  formatPercentChange,
  getTrendIndicator,
  type ArtworkStats,
  type GalleryStats,
  type RollingMetrics,
} from '@/lib/utils/analytics'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  SortableTableHead,
  type SortDirection,
} from '@/components/ui/table'

type TabId = 'overview' | 'artworks' | 'galleries' | 'matrix'

export default function AnalyticsPage() {
  const { allEditions, prints, distributors, isReady } = useInventory()
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const portfolioHealth = useMemo(
    () => calculatePortfolioHealth(allEditions, prints, distributors),
    [allEditions, prints, distributors]
  )

  const artworkStats = useMemo(
    () => calculateArtworkStats(allEditions, prints, distributors),
    [allEditions, prints, distributors]
  )

  const galleryStats = useMemo(
    () => calculateGalleryStats(allEditions, distributors),
    [allEditions, distributors]
  )

  const yoyComparison = useMemo(
    () => calculateYearOverYear(allEditions),
    [allEditions]
  )

  const rollingMetrics = useMemo(
    () => calculateRollingMetrics(allEditions),
    [allEditions]
  )

  const alerts = useMemo(
    () => generateInventoryAlerts(allEditions, prints, distributors),
    [allEditions, prints, distributors]
  )

  const matrix = useMemo(
    () => buildGalleryArtworkMatrix(allEditions, prints, distributors),
    [allEditions, prints, distributors]
  )

  if (!isReady) return null

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'artworks' as const, label: 'Artworks' },
    { id: 'galleries' as const, label: 'Galleries' },
    { id: 'matrix' as const, label: 'Matrix' },
  ]

  return (
    <div className="space-y-10">
      {/* Page header */}
      <header className="border-b border-border pb-8">
        <h1 className="text-foreground mb-2">Sales Analytics</h1>
        <p className="text-muted-foreground text-lg font-light">
          Scarcity-aware performance tracking across your portfolio
        </p>
      </header>

      {/* Tab navigation */}
      <div className="border-b border-border">
        <nav className="flex gap-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          portfolioHealth={portfolioHealth}
          yoyComparison={yoyComparison}
          rollingMetrics={rollingMetrics}
          alerts={alerts}
          artworkStats={artworkStats}
          galleryStats={galleryStats}
        />
      )}

      {activeTab === 'artworks' && (
        <ArtworksTab artworkStats={artworkStats} />
      )}

      {activeTab === 'galleries' && (
        <GalleriesTab galleryStats={galleryStats} allEditions={allEditions} />
      )}

      {activeTab === 'matrix' && (
        <MatrixTab
          matrix={matrix}
          prints={prints}
          distributors={distributors}
          galleryStats={galleryStats}
        />
      )}
    </div>
  )
}

// ============================================================================
// Overview Tab
// ============================================================================

function OverviewTab({
  portfolioHealth,
  yoyComparison,
  rollingMetrics,
  alerts,
  artworkStats,
  galleryStats,
}: {
  portfolioHealth: ReturnType<typeof calculatePortfolioHealth>
  yoyComparison: ReturnType<typeof calculateYearOverYear>
  rollingMetrics: RollingMetrics
  alerts: ReturnType<typeof generateInventoryAlerts>
  artworkStats: ArtworkStats[]
  galleryStats: GalleryStats[]
}) {
  return (
    <div className="space-y-10">
      {/* Portfolio Health */}
      <section>
        <h2 className="text-foreground mb-6">Portfolio Health</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Overall Sell-Through
            </p>
            <p className="stat-value text-foreground">
              {portfolioHealth.overallSellThrough.toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {portfolioHealth.totalSold.toLocaleString()} of {portfolioHealth.totalEditions.toLocaleString()} editions
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Revenue Realized
            </p>
            <p className="stat-value text-foreground">
              {formatPrice(portfolioHealth.totalNetRevenue)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Net after commission
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Remaining Potential
            </p>
            <p className="stat-value text-foreground">
              {formatPrice(portfolioHealth.totalRevenuePotential)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {portfolioHealth.totalRemaining.toLocaleString()} editions left
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Edition Status
            </p>
            <p className="stat-value text-foreground">
              {portfolioHealth.artworksSoldOut}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              sold out, {portfolioHealth.artworksNearingSellout} nearing
            </p>
          </div>
        </div>
      </section>

      {/* Rolling 12-Month Performance */}
      <section>
        <h2 className="text-foreground mb-6">Rolling 12-Month Performance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Last 12 Months
            </p>
            <p className="stat-value text-foreground">{rollingMetrics.rolling12MonthSales}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatPrice(rollingMetrics.rolling12MonthNetRevenue)} net revenue
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Previous 12 Months
            </p>
            <p className="stat-value text-foreground">{rollingMetrics.previousRolling12MonthSales}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatPrice(rollingMetrics.previousRolling12MonthNetRevenue)} net revenue
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              YoY Change
            </p>
            <p className={`stat-value ${rollingMetrics.yoyChangePercent >= 0 ? 'status-sold' : 'text-red-600'}`}>
              {getTrendIndicator(rollingMetrics.yoyChangePercent)} {formatPercentChange(rollingMetrics.yoyChangePercent)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {getTrendIndicator(rollingMetrics.yoyRevenueChangePercent)} {formatPercentChange(rollingMetrics.yoyRevenueChangePercent)} revenue
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              vs 3-Year Avg
            </p>
            <p className={`stat-value ${rollingMetrics.vsThreeYearAvgPercent >= 0 ? 'status-sold' : 'text-red-600'}`}>
              {getTrendIndicator(rollingMetrics.vsThreeYearAvgPercent)} {formatPercentChange(rollingMetrics.vsThreeYearAvgPercent)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              avg: {rollingMetrics.rolling3YearAvgSales.toFixed(1)} sales/year
            </p>
          </div>
        </div>
      </section>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section>
          <h2 className="text-foreground mb-6">Alerts & Insights</h2>
          <div className="space-y-3">
            {alerts.slice(0, 6).map((alert, i) => (
              <div
                key={i}
                className={`p-4 rounded-sm border-l-4 ${
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-500'
                    : alert.severity === 'warning'
                    ? 'bg-amber-50 border-amber-500'
                    : 'bg-blue-50 border-blue-500'
                }`}
              >
                <p className="font-medium text-foreground">{alert.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top 20 Tables */}
      <div className="grid lg:grid-cols-2 gap-10">
        {/* Top 20 Artworks */}
        <TopArtworksTable artworkStats={artworkStats} />

        {/* Top 20 Galleries */}
        <TopGalleriesTable galleryStats={galleryStats} />
      </div>
    </div>
  )
}

// Helper component for sortable Top 20 Artworks table
function TopArtworksTable({ artworkStats }: { artworkStats: ArtworkStats[] }) {
  const [sortKey, setSortKey] = useState<string>('sellThrough')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  const sortedStats = useMemo(() => {
    const sorted = [...artworkStats]
    const dir = sortDirection === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'sellThrough':
          cmp = a.sellThroughRate - b.sellThroughRate
          // Secondary sort by sold count for equal rates
          if (Math.abs(cmp) < 0.01) cmp = a.sold - b.sold
          break
        case 'sold':
          cmp = a.sold - b.sold
          break
        case 'remaining':
          cmp = a.remaining - b.remaining
          break
        default:
          cmp = a.sellThroughRate - b.sellThroughRate
      }
      return cmp * dir
    })
    return sorted.slice(0, 20)
  }, [artworkStats, sortKey, sortDirection])

  return (
    <section>
      <h2 className="text-foreground mb-6">Top 20 Artworks by Sell-Through</h2>
      <div className="border border-border rounded-sm overflow-hidden max-h-[600px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <SortableTableHead
                sortKey="name"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
              >
                Artwork
              </SortableTableHead>
              <SortableTableHead
                sortKey="sellThrough"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Sell-Through
              </SortableTableHead>
              <SortableTableHead
                sortKey="sold"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Sold
              </SortableTableHead>
              <SortableTableHead
                sortKey="remaining"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Remaining
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStats.map(artwork => (
              <TableRow key={artwork.printId}>
                <TableCell>
                  <Link
                    href={`/artworks/${artwork.printId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {artwork.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {artwork.sellThroughRate.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right">
                  {artwork.sold}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {artwork.remaining}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

// Helper component for sortable Top 20 Galleries table
function TopGalleriesTable({ galleryStats }: { galleryStats: GalleryStats[] }) {
  const [sortKey, setSortKey] = useState<string>('conversion')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  const sortedStats = useMemo(() => {
    const sorted = [...galleryStats]
    const dir = sortDirection === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'conversion':
          cmp = a.conversionRate - b.conversionRate
          // Secondary sort by sold count for equal rates
          if (Math.abs(cmp) < 0.01) cmp = a.totalSold - b.totalSold
          break
        case 'sold':
          cmp = a.totalSold - b.totalSold
          break
        case 'allocated':
          cmp = a.totalAllocated - b.totalAllocated
          break
        default:
          cmp = a.conversionRate - b.conversionRate
      }
      return cmp * dir
    })
    return sorted.slice(0, 20)
  }, [galleryStats, sortKey, sortDirection])

  return (
    <section>
      <h2 className="text-foreground mb-6">Top 20 Galleries by Conversion</h2>
      <div className="border border-border rounded-sm overflow-hidden max-h-[600px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <SortableTableHead
                sortKey="name"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
              >
                Gallery
              </SortableTableHead>
              <SortableTableHead
                sortKey="conversion"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Conversion
              </SortableTableHead>
              <SortableTableHead
                sortKey="sold"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Sold
              </SortableTableHead>
              <SortableTableHead
                sortKey="allocated"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Allocated
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStats.map(gallery => (
              <TableRow key={gallery.distributorId}>
                <TableCell>
                  <Link
                    href={`/galleries/${gallery.distributorId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {gallery.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {gallery.conversionRate.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right">
                  {gallery.totalSold}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {gallery.totalAllocated}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

// ============================================================================
// Artworks Tab
// ============================================================================

function ArtworksTab({ artworkStats }: { artworkStats: ArtworkStats[] }) {
  const [sortKey, setSortKey] = useState<string>('sellThrough')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      // Default to desc for most columns, asc for name/remaining
      setSortDirection(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sortedStats = useMemo(() => {
    const sorted = [...artworkStats]
    const dir = sortDirection === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'editionSize':
          cmp = a.totalEditions - b.totalEditions
          break
        case 'sold':
          cmp = a.sold - b.sold
          break
        case 'remaining':
          cmp = a.remaining - b.remaining
          break
        case 'sellThrough':
          cmp = a.sellThroughRate - b.sellThroughRate
          if (Math.abs(cmp) < 0.01) cmp = a.sold - b.sold
          break
        case 'velocity':
          cmp = a.velocityLast12Months - b.velocityLast12Months
          break
        case 'sellout':
          const aVal = a.estimatedMonthsToSellout ?? Infinity
          const bVal = b.estimatedMonthsToSellout ?? Infinity
          cmp = aVal - bVal
          break
        case 'revenue':
          cmp = a.totalRevenue - b.totalRevenue
          break
        default:
          cmp = a.sellThroughRate - b.sellThroughRate
      }
      return cmp * dir
    })
    return sorted
  }, [artworkStats, sortKey, sortDirection])

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Click column headers to sort. All {artworkStats.length} artworks shown.
      </p>

      {/* Artworks table */}
      <div className="border border-border rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                sortKey="name"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
              >
                Artwork
              </SortableTableHead>
              <SortableTableHead
                sortKey="editionSize"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Edition Size
              </SortableTableHead>
              <SortableTableHead
                sortKey="sold"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Sold
              </SortableTableHead>
              <SortableTableHead
                sortKey="remaining"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Remaining
              </SortableTableHead>
              <SortableTableHead
                sortKey="sellThrough"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Sell-Through
              </SortableTableHead>
              <SortableTableHead
                sortKey="velocity"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                12mo Velocity
              </SortableTableHead>
              <SortableTableHead
                sortKey="sellout"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Est. Sellout
              </SortableTableHead>
              <TableHead>Top Gallery</TableHead>
              <SortableTableHead
                sortKey="revenue"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Revenue
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStats.map(artwork => (
              <TableRow key={artwork.printId}>
                <TableCell>
                  <Link
                    href={`/artworks/${artwork.printId}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {artwork.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {artwork.totalEditions}
                </TableCell>
                <TableCell className="text-right">{artwork.sold}</TableCell>
                <TableCell className="text-right">
                  <span className={artwork.remaining <= 5 ? 'text-amber-600 font-medium' : ''}>
                    {artwork.remaining}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={`font-medium ${
                    artwork.sellThroughRate >= 90 ? 'text-green-600' :
                    artwork.sellThroughRate >= 50 ? 'text-foreground' :
                    'text-muted-foreground'
                  }`}>
                    {artwork.sellThroughRate.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={artwork.velocityPercentage >= 30 ? 'text-green-600' : ''}>
                    {artwork.velocityLast12Months} ({artwork.velocityPercentage.toFixed(0)}%)
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {artwork.estimatedMonthsToSellout !== null
                    ? artwork.estimatedMonthsToSellout <= 12
                      ? `${artwork.estimatedMonthsToSellout}mo`
                      : `${(artwork.estimatedMonthsToSellout / 12).toFixed(1)}yr`
                    : artwork.remaining === 0 ? 'Sold out' : '—'
                  }
                </TableCell>
                <TableCell>
                  {artwork.topGallery ? (
                    <Link
                      href={`/galleries/${artwork.topGallery.id}`}
                      className="text-sm hover:underline"
                    >
                      {artwork.topGallery.name} ({artwork.topGallery.sales})
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatPrice(artwork.totalRevenue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ============================================================================
// Galleries Tab
// ============================================================================

function GalleriesTab({
  galleryStats,
  allEditions,
}: {
  galleryStats: GalleryStats[]
  allEditions: ReturnType<typeof useInventory>['allEditions']
}) {
  const [sortKey, setSortKey] = useState<string>('conversion')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection(key === 'name' ? 'asc' : 'desc')
    }
  }

  // Pre-compute rolling metrics for each gallery
  const galleriesWithMetrics = useMemo(() => {
    return galleryStats.map(gallery => ({
      ...gallery,
      rollingMetrics: calculateRollingMetrics(allEditions, gallery.distributorId)
    }))
  }, [galleryStats, allEditions])

  const sortedStats = useMemo(() => {
    const sorted = [...galleriesWithMetrics]
    const dir = sortDirection === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'commission':
          cmp = a.commission - b.commission
          break
        case 'allocated':
          cmp = a.totalAllocated - b.totalAllocated
          break
        case 'sold':
          cmp = a.totalSold - b.totalSold
          break
        case 'conversion':
          cmp = a.conversionRate - b.conversionRate
          if (Math.abs(cmp) < 0.01) cmp = a.totalSold - b.totalSold
          break
        case 'inStock':
          cmp = a.inStock - b.inStock
          break
        case 'daysToSell':
          const aVal = a.avgDaysToSell ?? Infinity
          const bVal = b.avgDaysToSell ?? Infinity
          cmp = aVal - bVal
          break
        case 'sales12mo':
          cmp = a.salesLast12Months - b.salesLast12Months
          break
        case 'revenue':
          cmp = a.netRevenue - b.netRevenue
          break
        case 'unsettled':
          cmp = a.unsettledAmount - b.unsettledAmount
          break
        default:
          cmp = a.conversionRate - b.conversionRate
      }
      return cmp * dir
    })
    return sorted
  }, [galleriesWithMetrics, sortKey, sortDirection])

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Click column headers to sort. All {galleryStats.length} galleries shown. YoY uses rolling 12-month periods.
      </p>

      {/* Galleries table */}
      <div className="border border-border rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                sortKey="name"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
              >
                Gallery
              </SortableTableHead>
              <SortableTableHead
                sortKey="commission"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Commission
              </SortableTableHead>
              <SortableTableHead
                sortKey="allocated"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Allocated
              </SortableTableHead>
              <SortableTableHead
                sortKey="sold"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Sold
              </SortableTableHead>
              <SortableTableHead
                sortKey="conversion"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Conversion
              </SortableTableHead>
              <SortableTableHead
                sortKey="inStock"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                In Stock
              </SortableTableHead>
              <SortableTableHead
                sortKey="daysToSell"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Avg Days to Sell
              </SortableTableHead>
              <SortableTableHead
                sortKey="sales12mo"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                30d / 12mo
              </SortableTableHead>
              <SortableTableHead
                sortKey="revenue"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Net Revenue
              </SortableTableHead>
              <SortableTableHead
                sortKey="unsettled"
                currentSortKey={sortKey}
                currentDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              >
                Unsettled
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStats.map(gallery => (
              <TableRow key={gallery.distributorId}>
                <TableCell>
                  <div>
                    <Link
                      href={`/galleries/${gallery.distributorId}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {gallery.name}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      YoY: {formatPercentChange(gallery.rollingMetrics.yoyChangePercent)} {getTrendIndicator(gallery.rollingMetrics.yoyChangePercent)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {gallery.commission}%
                </TableCell>
                <TableCell className="text-right">{gallery.totalAllocated}</TableCell>
                <TableCell className="text-right">{gallery.totalSold}</TableCell>
                <TableCell className="text-right">
                  <span className={`font-medium ${
                    gallery.conversionRate >= 70 ? 'text-green-600' :
                    gallery.conversionRate >= 40 ? 'text-foreground' :
                    'text-amber-600'
                  }`}>
                    {gallery.conversionRate.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={gallery.inStock <= 3 && gallery.inStock > 0 ? 'text-amber-600' : ''}>
                    {gallery.inStock}
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {gallery.avgDaysToSell !== null ? `${gallery.avgDaysToSell}d` : '—'}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {gallery.salesLast30Days} / {gallery.salesLast12Months}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatPrice(gallery.netRevenue)}
                </TableCell>
                <TableCell className="text-right">
                  {gallery.unsettledCount > 0 ? (
                    <span className="text-amber-600">
                      {gallery.unsettledCount} ({formatPrice(gallery.unsettledAmount)})
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ============================================================================
// Matrix Tab
// ============================================================================

function MatrixTab({
  matrix,
  prints,
  distributors,
  galleryStats,
}: {
  matrix: Map<string, { allocated: number; sold: number; conversionRate: number; inStock: number }>
  prints: ReturnType<typeof useInventory>['prints']
  distributors: ReturnType<typeof useInventory>['distributors']
  galleryStats: GalleryStats[]
}) {
  // Only show galleries with allocations
  const activeGalleries = galleryStats.filter(g => g.totalAllocated > 0)

  // Only show artworks with gallery allocations
  const artworksWithAllocations = new Set<number>()
  matrix.forEach((_, key) => {
    const printId = parseInt(key.split('-')[1])
    artworksWithAllocations.add(printId)
  })

  const activePrints = prints.filter(p => artworksWithAllocations.has(p.id))

  const getCell = (galleryId: number, printId: number) => {
    return matrix.get(`${galleryId}-${printId}`)
  }

  const getCellColor = (conversionRate: number) => {
    if (conversionRate >= 80) return 'bg-green-100 text-green-800'
    if (conversionRate >= 50) return 'bg-blue-100 text-blue-800'
    if (conversionRate >= 20) return 'bg-amber-100 text-amber-800'
    if (conversionRate > 0) return 'bg-red-100 text-red-800'
    return 'bg-gray-50 text-gray-400'
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Shows conversion rate (sold/allocated) for each gallery-artwork combination.
        Darker green = higher conversion.
      </p>

      <div className="overflow-x-auto border border-border rounded-sm">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="sticky left-0 bg-muted/50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Gallery / Artwork
              </th>
              {activePrints.map(print => (
                <th
                  key={print.id}
                  className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                >
                  <Link href={`/artworks/${print.id}`} className="hover:text-foreground">
                    {print.name.length > 15 ? print.name.slice(0, 15) + '...' : print.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {activeGalleries.map(gallery => (
              <tr key={gallery.distributorId}>
                <td className="sticky left-0 bg-card whitespace-nowrap px-4 py-3 text-sm font-medium">
                  <Link
                    href={`/galleries/${gallery.distributorId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {gallery.name}
                  </Link>
                </td>
                {activePrints.map(print => {
                  const cell = getCell(gallery.distributorId, print.id)

                  return (
                    <td key={print.id} className="px-3 py-3 text-center">
                      {cell ? (
                        <div
                          className={`inline-flex flex-col items-center px-2 py-1 rounded text-xs ${getCellColor(cell.conversionRate)}`}
                          title={`${cell.sold}/${cell.allocated} sold (${cell.inStock} in stock)`}
                        >
                          <span className="font-medium">{cell.conversionRate.toFixed(0)}%</span>
                          <span className="text-[10px] opacity-75">
                            {cell.sold}/{cell.allocated}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Conversion:</span>
        <span className="px-2 py-0.5 rounded bg-green-100 text-green-800">80%+</span>
        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800">50-79%</span>
        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">20-49%</span>
        <span className="px-2 py-0.5 rounded bg-red-100 text-red-800">&lt;20%</span>
      </div>
    </div>
  )
}
