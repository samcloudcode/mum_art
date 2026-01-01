import type { EditionWithRelations, Print, Distributor } from '@/lib/types'

// ============================================================================
// Types
// ============================================================================

export type ArtworkStats = {
  printId: number
  name: string
  totalEditions: number
  sold: number
  remaining: number
  sellThroughRate: number
  avgPrice: number
  totalRevenue: number
  potentialRevenue: number
  velocityLast12Months: number
  velocityPercentage: number
  estimatedMonthsToSellout: number | null
  topGallery: { id: number; name: string; sales: number } | null
  salesByYear: Record<number, number>
}

export type GalleryStats = {
  distributorId: number
  name: string
  commission: number
  totalAllocated: number
  totalSold: number
  conversionRate: number
  inStock: number
  netRevenue: number
  grossRevenue: number
  unsettledAmount: number
  unsettledCount: number
  salesLast30Days: number
  salesLast12Months: number
  avgDaysToSell: number | null
  salesByYear: Record<number, number>
  artworkPerformance: Map<number, { allocated: number; sold: number; conversionRate: number }>
}

export type GalleryArtworkCell = {
  allocated: number
  sold: number
  conversionRate: number
  inStock: number
}

export type InventoryAlert = {
  type: 'low_stock' | 'nearly_sold_out' | 'stale_inventory' | 'high_velocity'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  artworkId?: number
  artworkName?: string
  galleryId?: number
  galleryName?: string
  value?: number
}

export type PortfolioHealth = {
  totalArtworks: number
  totalEditions: number
  totalSold: number
  totalRemaining: number
  overallSellThrough: number
  totalRevenueRealized: number
  totalRevenuePotential: number
  totalNetRevenue: number
  unsettledAmount: number
  unsettledCount: number
  avgSellThroughByArtwork: number
  artworksNearingSellout: number
  artworksSoldOut: number
}

export type YearOverYearComparison = {
  currentYear: number
  currentYearSales: number
  currentYearRevenue: number
  previousYear: number
  previousYearSales: number
  previousYearRevenue: number
  threeYearAvgSales: number
  threeYearAvgRevenue: number
  yoyChangePercent: number
  vsThreeYearAvgPercent: number
}

export type RollingMetrics = {
  // Rolling 12-month period (current)
  rolling12MonthSales: number
  rolling12MonthRevenue: number
  rolling12MonthNetRevenue: number
  // Previous rolling 12-month period (for YoY)
  previousRolling12MonthSales: number
  previousRolling12MonthRevenue: number
  previousRolling12MonthNetRevenue: number
  // Rolling 3-year average (36 months / 3)
  rolling3YearAvgSales: number
  rolling3YearAvgRevenue: number
  rolling3YearAvgNetRevenue: number
  // Change percentages
  yoyChangePercent: number
  yoyRevenueChangePercent: number
  vsThreeYearAvgPercent: number
  vsThreeYearAvgRevenuePercent: number
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateNetAmount(
  retailPrice: number | null | undefined,
  commissionPercentage: number | null | undefined
): number {
  if (!retailPrice) return 0
  const commission = commissionPercentage || 0
  return retailPrice * (1 - commission / 100)
}

function getDateRanges() {
  const now = new Date()
  const currentYear = now.getFullYear()

  return {
    now,
    currentYear,
    startOfYear: new Date(currentYear, 0, 1),
    thirtyDaysAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    twelveMonthsAgo: new Date(currentYear - 1, now.getMonth(), now.getDate()),
    previousYearStart: new Date(currentYear - 1, 0, 1),
    previousYearEnd: new Date(currentYear - 1, 11, 31, 23, 59, 59),
    threeYearsAgo: new Date(currentYear - 3, 0, 1),
  }
}

function isInRange(dateStr: string | null, start: Date, end: Date): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d >= start && d <= end
}

function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffTime = endDate.getTime() - startDate.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if an edition should be counted in analytics
 * Excludes edition 0 and negative editions (artist proofs, test prints, etc.)
 */
function shouldCountEdition(edition: EditionWithRelations): boolean {
  return edition.edition_number != null && edition.edition_number > 0
}

// ============================================================================
// Core Analytics Functions
// ============================================================================

/**
 * Calculate comprehensive artwork statistics with scarcity awareness
 */
export function calculateArtworkStats(
  editions: EditionWithRelations[],
  prints: Print[],
  distributors: Distributor[]
): ArtworkStats[] {
  const ranges = getDateRanges()
  const distributorMap = new Map(distributors.map(d => [d.id, d]))

  const statsMap = new Map<number, ArtworkStats>()

  // Initialize stats for each print
  prints.forEach(print => {
    statsMap.set(print.id, {
      printId: print.id,
      name: print.name,
      totalEditions: print.total_editions || 0,
      sold: 0,
      remaining: 0,
      sellThroughRate: 0,
      avgPrice: 0,
      totalRevenue: 0,
      potentialRevenue: 0,
      velocityLast12Months: 0,
      velocityPercentage: 0,
      estimatedMonthsToSellout: null,
      topGallery: null,
      salesByYear: {},
    })
  })

  // Process editions
  const gallerySalesCount = new Map<number, Map<number, number>>() // printId -> (galleryId -> count)
  const pricesByPrint = new Map<number, number[]>()

  editions.forEach(edition => {
    const stats = statsMap.get(edition.print_id)
    if (!stats) return

    // Skip edition 0 and negative editions from counts
    if (!shouldCountEdition(edition)) return

    if (edition.is_sold) {
      stats.sold++

      // Track revenue
      if (edition.retail_price) {
        stats.totalRevenue += edition.retail_price

        // Track prices for average
        if (!pricesByPrint.has(edition.print_id)) {
          pricesByPrint.set(edition.print_id, [])
        }
        pricesByPrint.get(edition.print_id)!.push(edition.retail_price)
      }

      // Track sales by year
      if (edition.date_sold) {
        const year = new Date(edition.date_sold).getFullYear()
        stats.salesByYear[year] = (stats.salesByYear[year] || 0) + 1

        // Track velocity (last 12 months)
        if (isInRange(edition.date_sold, ranges.twelveMonthsAgo, ranges.now)) {
          stats.velocityLast12Months++
        }
      }

      // Track gallery sales for top performer
      if (edition.distributor_id) {
        if (!gallerySalesCount.has(edition.print_id)) {
          gallerySalesCount.set(edition.print_id, new Map())
        }
        const printGalleries = gallerySalesCount.get(edition.print_id)!
        printGalleries.set(
          edition.distributor_id,
          (printGalleries.get(edition.distributor_id) || 0) + 1
        )
      }
    } else if (edition.is_printed) {
      stats.remaining++
    }
  })

  // Calculate derived stats
  statsMap.forEach((stats, printId) => {
    // Use actual edition count if total_editions not set
    // Only count editions with edition_number > 0
    const printEditions = editions.filter(e => e.print_id === printId && shouldCountEdition(e))
    if (stats.totalEditions === 0) {
      stats.totalEditions = printEditions.length
    }

    // Remaining should include unprinted
    stats.remaining = stats.totalEditions - stats.sold

    // Sell-through rate
    stats.sellThroughRate = stats.totalEditions > 0
      ? (stats.sold / stats.totalEditions) * 100
      : 0

    // Average price
    const prices = pricesByPrint.get(printId) || []
    stats.avgPrice = prices.length > 0
      ? prices.reduce((a, b) => a + b, 0) / prices.length
      : 0

    // Potential remaining revenue
    stats.potentialRevenue = stats.remaining * stats.avgPrice

    // Velocity as percentage of remaining
    stats.velocityPercentage = stats.remaining > 0
      ? (stats.velocityLast12Months / stats.remaining) * 100
      : stats.velocityLast12Months > 0 ? 100 : 0

    // Estimated months to sellout
    if (stats.velocityLast12Months > 0 && stats.remaining > 0) {
      const monthlyRate = stats.velocityLast12Months / 12
      stats.estimatedMonthsToSellout = Math.ceil(stats.remaining / monthlyRate)
    }

    // Find top gallery
    const printGalleries = gallerySalesCount.get(printId)
    if (printGalleries && printGalleries.size > 0) {
      let topId = 0
      let topCount = 0
      printGalleries.forEach((count, galleryId) => {
        if (count > topCount) {
          topId = galleryId
          topCount = count
        }
      })
      const topDist = distributorMap.get(topId)
      if (topDist) {
        stats.topGallery = { id: topId, name: topDist.name, sales: topCount }
      }
    }
  })

  return Array.from(statsMap.values())
    .sort((a, b) => {
      // Primary sort by sell-through rate
      const rateDiff = b.sellThroughRate - a.sellThroughRate
      if (Math.abs(rateDiff) > 0.01) return rateDiff
      // Secondary sort by sold count (highest first) for equal rates
      return b.sold - a.sold
    })
}

/**
 * Calculate gallery efficiency statistics with conversion rates
 */
export function calculateGalleryStats(
  editions: EditionWithRelations[],
  distributors: Distributor[]
): GalleryStats[] {
  const ranges = getDateRanges()
  const statsMap = new Map<number, GalleryStats>()

  // Initialize stats for each distributor
  distributors.forEach(dist => {
    statsMap.set(dist.id, {
      distributorId: dist.id,
      name: dist.name,
      commission: dist.commission_percentage || 0,
      totalAllocated: 0,
      totalSold: 0,
      conversionRate: 0,
      inStock: 0,
      netRevenue: 0,
      grossRevenue: 0,
      unsettledAmount: 0,
      unsettledCount: 0,
      salesLast30Days: 0,
      salesLast12Months: 0,
      avgDaysToSell: null,
      salesByYear: {},
      artworkPerformance: new Map(),
    })
  })

  // Track days to sell for average calculation
  const daysToSellByGallery = new Map<number, number[]>()

  editions.forEach(edition => {
    if (!edition.distributor_id) return

    const stats = statsMap.get(edition.distributor_id)
    if (!stats) return

    // Skip edition 0 and negative editions from counts
    if (!shouldCountEdition(edition)) return

    // Only count printed editions as allocated
    if (edition.is_printed) {
      stats.totalAllocated++

      // Track artwork-level performance
      let artworkPerf = stats.artworkPerformance.get(edition.print_id)
      if (!artworkPerf) {
        artworkPerf = { allocated: 0, sold: 0, conversionRate: 0 }
        stats.artworkPerformance.set(edition.print_id, artworkPerf)
      }
      artworkPerf.allocated++

      if (edition.is_sold) {
        stats.totalSold++
        artworkPerf.sold++

        // Revenue
        if (edition.retail_price) {
          stats.grossRevenue += edition.retail_price
          const commission = edition.commission_percentage ?? stats.commission
          stats.netRevenue += calculateNetAmount(edition.retail_price, commission)

          // Unsettled
          if (!edition.is_settled) {
            stats.unsettledCount++
            stats.unsettledAmount += calculateNetAmount(edition.retail_price, commission)
          }
        }

        // Time-based stats
        if (edition.date_sold) {
          const year = new Date(edition.date_sold).getFullYear()
          stats.salesByYear[year] = (stats.salesByYear[year] || 0) + 1

          if (isInRange(edition.date_sold, ranges.thirtyDaysAgo, ranges.now)) {
            stats.salesLast30Days++
          }
          if (isInRange(edition.date_sold, ranges.twelveMonthsAgo, ranges.now)) {
            stats.salesLast12Months++
          }

          // Days to sell
          const days = daysBetween(edition.date_in_gallery, edition.date_sold)
          if (days !== null && days >= 0) {
            if (!daysToSellByGallery.has(edition.distributor_id)) {
              daysToSellByGallery.set(edition.distributor_id, [])
            }
            daysToSellByGallery.get(edition.distributor_id)!.push(days)
          }
        }
      } else {
        stats.inStock++
      }
    }
  })

  // Calculate derived stats
  statsMap.forEach((stats, galleryId) => {
    // Conversion rate
    stats.conversionRate = stats.totalAllocated > 0
      ? (stats.totalSold / stats.totalAllocated) * 100
      : 0

    // Artwork-level conversion rates
    stats.artworkPerformance.forEach(perf => {
      perf.conversionRate = perf.allocated > 0
        ? (perf.sold / perf.allocated) * 100
        : 0
    })

    // Average days to sell
    const days = daysToSellByGallery.get(galleryId)
    if (days && days.length > 0) {
      stats.avgDaysToSell = Math.round(days.reduce((a, b) => a + b, 0) / days.length)
    }
  })

  return Array.from(statsMap.values())
    .filter(s => s.totalAllocated > 0 || s.totalSold > 0)
    .sort((a, b) => {
      // Primary sort by conversion rate
      const rateDiff = b.conversionRate - a.conversionRate
      if (Math.abs(rateDiff) > 0.01) return rateDiff
      // Secondary sort by sold count (highest first) for equal rates
      return b.totalSold - a.totalSold
    })
}

/**
 * Build a gallery x artwork matrix showing conversion rates
 */
export function buildGalleryArtworkMatrix(
  editions: EditionWithRelations[],
  prints: Print[],
  distributors: Distributor[]
): Map<string, GalleryArtworkCell> {
  const matrix = new Map<string, GalleryArtworkCell>()

  editions.forEach(edition => {
    if (!edition.distributor_id || !edition.is_printed) return

    // Skip edition 0 and negative editions from counts
    if (!shouldCountEdition(edition)) return

    const key = `${edition.distributor_id}-${edition.print_id}`
    let cell = matrix.get(key)

    if (!cell) {
      cell = { allocated: 0, sold: 0, conversionRate: 0, inStock: 0 }
      matrix.set(key, cell)
    }

    cell.allocated++
    if (edition.is_sold) {
      cell.sold++
    } else {
      cell.inStock++
    }
  })

  // Calculate conversion rates
  matrix.forEach(cell => {
    cell.conversionRate = cell.allocated > 0
      ? (cell.sold / cell.allocated) * 100
      : 0
  })

  return matrix
}

/**
 * Calculate portfolio health metrics
 */
export function calculatePortfolioHealth(
  editions: EditionWithRelations[],
  prints: Print[],
  distributors: Distributor[]
): PortfolioHealth {
  const artworkStats = calculateArtworkStats(editions, prints, distributors)

  const totalEditions = artworkStats.reduce((sum, a) => sum + a.totalEditions, 0)
  const totalSold = artworkStats.reduce((sum, a) => sum + a.sold, 0)
  const totalRemaining = artworkStats.reduce((sum, a) => sum + a.remaining, 0)
  const totalRevenue = artworkStats.reduce((sum, a) => sum + a.totalRevenue, 0)
  const totalPotential = artworkStats.reduce((sum, a) => sum + a.potentialRevenue, 0)

  // Calculate net revenue (after commission)
  let totalNetRevenue = 0
  let unsettledAmount = 0
  let unsettledCount = 0

  editions.forEach(e => {
    if (e.is_sold && e.retail_price) {
      const commission = e.commission_percentage ?? e.distributors?.commission_percentage ?? 0
      totalNetRevenue += calculateNetAmount(e.retail_price, commission)

      if (!e.is_settled) {
        unsettledCount++
        unsettledAmount += calculateNetAmount(e.retail_price, commission)
      }
    }
  })

  const avgSellThrough = artworkStats.length > 0
    ? artworkStats.reduce((sum, a) => sum + a.sellThroughRate, 0) / artworkStats.length
    : 0

  return {
    totalArtworks: prints.length,
    totalEditions,
    totalSold,
    totalRemaining,
    overallSellThrough: totalEditions > 0 ? (totalSold / totalEditions) * 100 : 0,
    totalRevenueRealized: totalRevenue,
    totalRevenuePotential: totalPotential,
    totalNetRevenue,
    unsettledAmount,
    unsettledCount,
    avgSellThroughByArtwork: avgSellThrough,
    artworksNearingSellout: artworkStats.filter(a => a.sellThroughRate >= 90 && a.remaining > 0).length,
    artworksSoldOut: artworkStats.filter(a => a.remaining === 0).length,
  }
}

/**
 * Calculate year-over-year comparison with 3-year average
 */
export function calculateYearOverYear(
  editions: EditionWithRelations[],
  galleryId?: number
): YearOverYearComparison {
  const ranges = getDateRanges()
  const currentYear = ranges.currentYear

  const filteredEditions = galleryId
    ? editions.filter(e => e.distributor_id === galleryId)
    : editions

  const salesByYear = new Map<number, { count: number; revenue: number }>()

  filteredEditions.forEach(e => {
    if (!e.is_sold || !e.date_sold) return

    const year = new Date(e.date_sold).getFullYear()
    const current = salesByYear.get(year) || { count: 0, revenue: 0 }
    current.count++
    current.revenue += e.retail_price || 0
    salesByYear.set(year, current)
  })

  const currentStats = salesByYear.get(currentYear) || { count: 0, revenue: 0 }
  const prevStats = salesByYear.get(currentYear - 1) || { count: 0, revenue: 0 }

  // Three year average (previous 3 years, not including current)
  let threeYearTotal = { count: 0, revenue: 0 }
  let yearsWithData = 0
  for (let y = currentYear - 3; y < currentYear; y++) {
    const yearStats = salesByYear.get(y)
    if (yearStats) {
      threeYearTotal.count += yearStats.count
      threeYearTotal.revenue += yearStats.revenue
      yearsWithData++
    }
  }

  const threeYearAvgSales = yearsWithData > 0 ? threeYearTotal.count / yearsWithData : 0
  const threeYearAvgRevenue = yearsWithData > 0 ? threeYearTotal.revenue / yearsWithData : 0

  const yoyChangePercent = prevStats.count > 0
    ? ((currentStats.count - prevStats.count) / prevStats.count) * 100
    : currentStats.count > 0 ? 100 : 0

  const vsThreeYearAvgPercent = threeYearAvgSales > 0
    ? ((currentStats.count - threeYearAvgSales) / threeYearAvgSales) * 100
    : currentStats.count > 0 ? 100 : 0

  return {
    currentYear,
    currentYearSales: currentStats.count,
    currentYearRevenue: currentStats.revenue,
    previousYear: currentYear - 1,
    previousYearSales: prevStats.count,
    previousYearRevenue: prevStats.revenue,
    threeYearAvgSales,
    threeYearAvgRevenue,
    yoyChangePercent,
    vsThreeYearAvgPercent,
  }
}

/**
 * Calculate rolling 12-month metrics with YoY comparison and 3-year average
 * Uses rolling periods instead of calendar years for more accurate trend analysis
 */
export function calculateRollingMetrics(
  editions: EditionWithRelations[],
  galleryId?: number
): RollingMetrics {
  const now = new Date()

  // Define rolling periods
  const rolling12MonthsStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  const previousRolling12MonthsEnd = new Date(rolling12MonthsStart.getTime() - 1) // Day before current period
  const previousRolling12MonthsStart = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
  const rolling3YearsStart = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate())

  const filteredEditions = galleryId
    ? editions.filter(e => e.distributor_id === galleryId)
    : editions

  // Aggregate by period
  let current = { count: 0, revenue: 0, netRevenue: 0 }
  let previous = { count: 0, revenue: 0, netRevenue: 0 }
  let threeYear = { count: 0, revenue: 0, netRevenue: 0 }

  filteredEditions.forEach(e => {
    if (!e.is_sold || !e.date_sold) return

    const saleDate = new Date(e.date_sold)
    const price = e.retail_price || 0
    const commission = e.commission_percentage ?? e.distributors?.commission_percentage ?? 0
    const netAmount = price * (1 - commission / 100)

    // Current rolling 12 months
    if (saleDate >= rolling12MonthsStart && saleDate <= now) {
      current.count++
      current.revenue += price
      current.netRevenue += netAmount
    }

    // Previous rolling 12 months (for YoY)
    if (saleDate >= previousRolling12MonthsStart && saleDate <= previousRolling12MonthsEnd) {
      previous.count++
      previous.revenue += price
      previous.netRevenue += netAmount
    }

    // Rolling 3 years (for average - includes all 36 months before current period)
    if (saleDate >= rolling3YearsStart && saleDate < rolling12MonthsStart) {
      threeYear.count++
      threeYear.revenue += price
      threeYear.netRevenue += netAmount
    }
  })

  // Calculate 3-year averages (annual averages from 36-month data)
  const rolling3YearAvgSales = threeYear.count / 3
  const rolling3YearAvgRevenue = threeYear.revenue / 3
  const rolling3YearAvgNetRevenue = threeYear.netRevenue / 3

  // Calculate change percentages
  const yoyChangePercent = previous.count > 0
    ? ((current.count - previous.count) / previous.count) * 100
    : current.count > 0 ? 100 : 0

  const yoyRevenueChangePercent = previous.revenue > 0
    ? ((current.revenue - previous.revenue) / previous.revenue) * 100
    : current.revenue > 0 ? 100 : 0

  const vsThreeYearAvgPercent = rolling3YearAvgSales > 0
    ? ((current.count - rolling3YearAvgSales) / rolling3YearAvgSales) * 100
    : current.count > 0 ? 100 : 0

  const vsThreeYearAvgRevenuePercent = rolling3YearAvgRevenue > 0
    ? ((current.revenue - rolling3YearAvgRevenue) / rolling3YearAvgRevenue) * 100
    : current.revenue > 0 ? 100 : 0

  return {
    rolling12MonthSales: current.count,
    rolling12MonthRevenue: current.revenue,
    rolling12MonthNetRevenue: current.netRevenue,
    previousRolling12MonthSales: previous.count,
    previousRolling12MonthRevenue: previous.revenue,
    previousRolling12MonthNetRevenue: previous.netRevenue,
    rolling3YearAvgSales,
    rolling3YearAvgRevenue,
    rolling3YearAvgNetRevenue,
    yoyChangePercent,
    yoyRevenueChangePercent,
    vsThreeYearAvgPercent,
    vsThreeYearAvgRevenuePercent,
  }
}

/**
 * Generate inventory alerts based on various conditions
 */
export function generateInventoryAlerts(
  editions: EditionWithRelations[],
  prints: Print[],
  distributors: Distributor[]
): InventoryAlert[] {
  const alerts: InventoryAlert[] = []
  const artworkStats = calculateArtworkStats(editions, prints, distributors)
  const galleryStats = calculateGalleryStats(editions, distributors)
  const now = new Date()
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  // Artwork-level alerts
  artworkStats.forEach(artwork => {
    // Nearly sold out (< 5 remaining and > 90% sold)
    if (artwork.remaining > 0 && artwork.remaining <= 5 && artwork.sellThroughRate >= 90) {
      alerts.push({
        type: 'nearly_sold_out',
        severity: 'warning',
        title: `${artwork.name} nearly sold out`,
        description: `Only ${artwork.remaining} editions remaining (${artwork.sellThroughRate.toFixed(0)}% sold)`,
        artworkId: artwork.printId,
        artworkName: artwork.name,
        value: artwork.remaining,
      })
    }

    // Completely sold out
    if (artwork.remaining === 0 && artwork.sold > 0) {
      alerts.push({
        type: 'nearly_sold_out',
        severity: 'info',
        title: `${artwork.name} sold out`,
        description: `All ${artwork.sold} editions have been sold`,
        artworkId: artwork.printId,
        artworkName: artwork.name,
        value: 0,
      })
    }

    // High velocity (selling fast relative to remaining)
    if (artwork.velocityPercentage >= 50 && artwork.remaining > 5) {
      alerts.push({
        type: 'high_velocity',
        severity: 'info',
        title: `${artwork.name} selling quickly`,
        description: `${artwork.velocityLast12Months} sold in last 12 months (${artwork.velocityPercentage.toFixed(0)}% of remaining stock)`,
        artworkId: artwork.printId,
        artworkName: artwork.name,
        value: artwork.velocityLast12Months,
      })
    }
  })

  // Gallery-level alerts
  galleryStats.forEach(gallery => {
    // Low stock at gallery
    if (gallery.inStock > 0 && gallery.inStock <= 3 && gallery.salesLast12Months > 0) {
      alerts.push({
        type: 'low_stock',
        severity: 'warning',
        title: `Low stock at ${gallery.name}`,
        description: `Only ${gallery.inStock} editions in stock. Sold ${gallery.salesLast12Months} in last 12 months.`,
        galleryId: gallery.distributorId,
        galleryName: gallery.name,
        value: gallery.inStock,
      })
    }

    // Unsettled payments overdue (assuming 60 days is threshold)
    if (gallery.unsettledCount >= 3) {
      alerts.push({
        type: 'stale_inventory',
        severity: 'warning',
        title: `Unsettled payments at ${gallery.name}`,
        description: `${gallery.unsettledCount} sales (£${gallery.unsettledAmount.toLocaleString()}) awaiting payment`,
        galleryId: gallery.distributorId,
        galleryName: gallery.name,
        value: gallery.unsettledAmount,
      })
    }
  })

  // Stale inventory (in gallery for 180+ days without selling)
  const staleByGallery = new Map<number, number>()
  editions.forEach(e => {
    // Skip edition 0 and negative editions
    if (!shouldCountEdition(e)) return
    if (e.distributor_id && e.is_printed && !e.is_sold && e.date_in_gallery) {
      const daysInGallery = daysBetween(e.date_in_gallery, now.toISOString())
      if (daysInGallery !== null && daysInGallery >= 180) {
        staleByGallery.set(
          e.distributor_id,
          (staleByGallery.get(e.distributor_id) || 0) + 1
        )
      }
    }
  })

  staleByGallery.forEach((count, galleryId) => {
    if (count >= 3) {
      const gallery = distributors.find(d => d.id === galleryId)
      if (gallery) {
        alerts.push({
          type: 'stale_inventory',
          severity: 'info',
          title: `Stale inventory at ${gallery.name}`,
          description: `${count} editions have been at this gallery for 6+ months without selling`,
          galleryId,
          galleryName: gallery.name,
          value: count,
        })
      }
    }
  })

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}

/**
 * Format percentage with + or - sign
 */
export function formatPercentChange(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

/**
 * Get trend indicator
 */
export function getTrendIndicator(value: number): '▲' | '▼' | '—' {
  if (value > 1) return '▲'
  if (value < -1) return '▼'
  return '—'
}
