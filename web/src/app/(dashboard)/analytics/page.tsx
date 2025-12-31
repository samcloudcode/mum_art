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
  generateInventoryAlerts,
  buildGalleryArtworkMatrix,
  formatPercentChange,
  getTrendIndicator,
  type ArtworkStats,
  type GalleryStats,
} from '@/lib/utils/analytics'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  alerts,
  artworkStats,
  galleryStats,
}: {
  portfolioHealth: ReturnType<typeof calculatePortfolioHealth>
  yoyComparison: ReturnType<typeof calculateYearOverYear>
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

      {/* Year over Year Comparison */}
      <section>
        <h2 className="text-foreground mb-6">Year-over-Year Performance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              {yoyComparison.currentYear} Sales
            </p>
            <p className="stat-value text-foreground">{yoyComparison.currentYearSales}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatPrice(yoyComparison.currentYearRevenue)} revenue
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              {yoyComparison.previousYear} Sales
            </p>
            <p className="stat-value text-foreground">{yoyComparison.previousYearSales}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatPrice(yoyComparison.previousYearRevenue)} revenue
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              YoY Change
            </p>
            <p className={`stat-value ${yoyComparison.yoyChangePercent >= 0 ? 'status-sold' : 'text-red-600'}`}>
              {getTrendIndicator(yoyComparison.yoyChangePercent)} {formatPercentChange(yoyComparison.yoyChangePercent)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              vs previous year
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              vs 3-Year Avg
            </p>
            <p className={`stat-value ${yoyComparison.vsThreeYearAvgPercent >= 0 ? 'status-sold' : 'text-red-600'}`}>
              {getTrendIndicator(yoyComparison.vsThreeYearAvgPercent)} {formatPercentChange(yoyComparison.vsThreeYearAvgPercent)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              avg: {yoyComparison.threeYearAvgSales.toFixed(1)} sales/year
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

      {/* Quick Stats Tables */}
      <div className="grid lg:grid-cols-2 gap-10">
        {/* Top Performing Artworks */}
        <section>
          <h2 className="text-foreground mb-6">Top Artworks by Sell-Through</h2>
          <div className="border border-border rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artwork</TableHead>
                  <TableHead className="text-right">Sell-Through</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artworkStats.slice(0, 5).map(artwork => (
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
                    <TableCell className="text-right text-muted-foreground">
                      {artwork.remaining}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Top Galleries by Conversion */}
        <section>
          <h2 className="text-foreground mb-6">Top Galleries by Conversion</h2>
          <div className="border border-border rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gallery</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {galleryStats.slice(0, 5).map(gallery => (
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
                    <TableCell className="text-right text-muted-foreground">
                      {gallery.totalSold}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  )
}

// ============================================================================
// Artworks Tab
// ============================================================================

function ArtworksTab({ artworkStats }: { artworkStats: ArtworkStats[] }) {
  const [sortBy, setSortBy] = useState<'sellThrough' | 'velocity' | 'remaining' | 'revenue'>('sellThrough')

  const sortedStats = useMemo(() => {
    const sorted = [...artworkStats]
    switch (sortBy) {
      case 'sellThrough':
        return sorted.sort((a, b) => b.sellThroughRate - a.sellThroughRate)
      case 'velocity':
        return sorted.sort((a, b) => b.velocityPercentage - a.velocityPercentage)
      case 'remaining':
        return sorted.sort((a, b) => a.remaining - b.remaining)
      case 'revenue':
        return sorted.sort((a, b) => b.totalRevenue - a.totalRevenue)
      default:
        return sorted
    }
  }, [artworkStats, sortBy])

  return (
    <div className="space-y-6">
      {/* Sort controls */}
      <div className="flex gap-2">
        <span className="text-sm text-muted-foreground py-2">Sort by:</span>
        {[
          { id: 'sellThrough' as const, label: 'Sell-Through' },
          { id: 'velocity' as const, label: 'Velocity' },
          { id: 'remaining' as const, label: 'Scarcity' },
          { id: 'revenue' as const, label: 'Revenue' },
        ].map(option => (
          <button
            key={option.id}
            onClick={() => setSortBy(option.id)}
            className={`px-3 py-1.5 text-sm rounded-sm transition-colors ${
              sortBy === option.id
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Artworks table */}
      <div className="border border-border rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Artwork</TableHead>
              <TableHead className="text-right">Edition Size</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Sell-Through</TableHead>
              <TableHead className="text-right">12mo Velocity</TableHead>
              <TableHead className="text-right">Est. Sellout</TableHead>
              <TableHead>Top Gallery</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
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
  return (
    <div className="space-y-6">
      {/* Galleries table */}
      <div className="border border-border rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gallery</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
              <TableHead className="text-right">In Stock</TableHead>
              <TableHead className="text-right">Avg Days to Sell</TableHead>
              <TableHead className="text-right">30d / 12mo</TableHead>
              <TableHead className="text-right">Net Revenue</TableHead>
              <TableHead className="text-right">Unsettled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {galleryStats.map(gallery => {
              const yoy = calculateYearOverYear(allEditions, gallery.distributorId)

              return (
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
                        YoY: {formatPercentChange(yoy.yoyChangePercent)} {getTrendIndicator(yoy.yoyChangePercent)}
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
              )
            })}
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
