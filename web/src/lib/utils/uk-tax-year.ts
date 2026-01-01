import type { EditionWithRelations, Distributor } from '@/lib/types'

// ============================================================================
// UK Tax Year Utilities
// ============================================================================

/**
 * UK Tax Year runs from April 6 to April 5
 * e.g., Tax Year 2024-25 = April 6, 2024 → April 5, 2025
 */

export type TaxYear = {
  label: string        // e.g., "2024-25"
  startYear: number    // e.g., 2024
  endYear: number      // e.g., 2025
  startDate: Date      // April 6, startYear
  endDate: Date        // April 5, endYear (23:59:59)
}

export type TaxYearSale = {
  id: number
  dateSold: string
  editionDisplayName: string
  artworkName: string
  distributorName: string
  distributorId: number | null
  retailPrice: number
  commissionPercentage: number
  commissionAmount: number
  netAmount: number
  isSettled: boolean
}

export type ChannelBreakdown = {
  distributorId: number | null
  distributorName: string
  commissionPercentage: number
  salesCount: number
  grossRevenue: number
  totalCommission: number
  netRevenue: number
  settledAmount: number
  unsettledAmount: number
}

export type MonthlyBreakdown = {
  monthKey: string     // e.g., "2024-04"
  monthLabel: string   // e.g., "April 2024"
  taxYearMonth: number // 1-12 where April = 1
  salesCount: number
  grossRevenue: number
  totalCommission: number
  netRevenue: number
}

export type QuarterlyBreakdown = {
  quarter: number      // 1-4
  quarterLabel: string // e.g., "Q1 (Apr-Jun)"
  salesCount: number
  grossRevenue: number
  totalCommission: number
  netRevenue: number
}

export type TaxYearReport = {
  taxYear: TaxYear
  // Summary
  totalSalesCount: number
  grossRevenue: number
  totalCommission: number
  netRevenue: number
  settledAmount: number
  unsettledAmount: number
  unsettledCount: number
  // Breakdowns
  byChannel: ChannelBreakdown[]
  byMonth: MonthlyBreakdown[]
  byQuarter: QuarterlyBreakdown[]
  // Individual sales for register
  sales: TaxYearSale[]
  // Comparison with previous year
  previousYear?: {
    taxYear: TaxYear
    salesCount: number
    grossRevenue: number
    netRevenue: number
  }
}

/**
 * Get the current UK tax year
 */
export function getCurrentTaxYear(): TaxYear {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed
  const day = now.getDate()

  // If before April 6, we're in the previous tax year
  if (month < 3 || (month === 3 && day < 6)) {
    return getTaxYear(year - 1)
  }
  return getTaxYear(year)
}

/**
 * Get a specific UK tax year by start year
 */
export function getTaxYear(startYear: number): TaxYear {
  const endYear = startYear + 1
  return {
    label: `${startYear}-${String(endYear).slice(-2)}`,
    startYear,
    endYear,
    startDate: new Date(startYear, 3, 6, 0, 0, 0), // April 6
    endDate: new Date(endYear, 3, 5, 23, 59, 59),  // April 5
  }
}

/**
 * Get available tax years from sales data
 * Returns array sorted newest first
 */
export function getAvailableTaxYears(editions: EditionWithRelations[]): TaxYear[] {
  const yearsSet = new Set<number>()

  editions.forEach(e => {
    if (e.is_sold && e.date_sold) {
      const saleDate = new Date(e.date_sold)
      const year = saleDate.getFullYear()
      const month = saleDate.getMonth()
      const day = saleDate.getDate()

      // Determine which tax year this sale falls into
      if (month < 3 || (month === 3 && day < 6)) {
        yearsSet.add(year - 1) // Before April 6, belongs to previous tax year
      } else {
        yearsSet.add(year)
      }
    }
  })

  // Always include current tax year
  const currentTaxYear = getCurrentTaxYear()
  yearsSet.add(currentTaxYear.startYear)

  return Array.from(yearsSet)
    .sort((a, b) => b - a)
    .map(getTaxYear)
}

/**
 * Check if a date falls within a tax year
 */
export function isInTaxYear(dateStr: string | null, taxYear: TaxYear): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  return date >= taxYear.startDate && date <= taxYear.endDate
}

/**
 * Get the tax year month number (1 = April, 12 = March)
 */
function getTaxYearMonth(date: Date): number {
  const month = date.getMonth() // 0-11
  // April (3) = 1, May (4) = 2, ... March (2) = 12
  return ((month - 3 + 12) % 12) + 1
}

/**
 * Get the tax year quarter (1 = Apr-Jun, 2 = Jul-Sep, 3 = Oct-Dec, 4 = Jan-Mar)
 */
function getTaxYearQuarter(date: Date): number {
  const taxMonth = getTaxYearMonth(date)
  return Math.ceil(taxMonth / 3)
}

/**
 * Calculate comprehensive UK tax year report
 */
export function calculateTaxYearReport(
  editions: EditionWithRelations[],
  distributors: Distributor[],
  taxYear: TaxYear,
  includePreviousYear = true
): TaxYearReport {
  const distributorMap = new Map(distributors.map(d => [d.id, d]))

  // Filter sales for this tax year
  const taxYearEditions = editions.filter(e =>
    e.is_sold && isInTaxYear(e.date_sold, taxYear)
  )

  // Build individual sales records
  const sales: TaxYearSale[] = taxYearEditions
    .map(e => {
      const retailPrice = e.retail_price || 0
      const commissionPercentage = e.commission_percentage ??
        e.distributors?.commission_percentage ?? 0
      const commissionAmount = retailPrice * (commissionPercentage / 100)
      const netAmount = retailPrice - commissionAmount

      return {
        id: e.id,
        dateSold: e.date_sold!,
        editionDisplayName: e.edition_display_name,
        artworkName: e.prints?.name || 'Unknown',
        distributorName: e.distributors?.name || 'Direct',
        distributorId: e.distributor_id,
        retailPrice,
        commissionPercentage,
        commissionAmount,
        netAmount,
        isSettled: e.is_settled || false,
      }
    })
    .sort((a, b) => new Date(a.dateSold).getTime() - new Date(b.dateSold).getTime())

  // Calculate totals
  let totalSalesCount = 0
  let grossRevenue = 0
  let totalCommission = 0
  let netRevenue = 0
  let settledAmount = 0
  let unsettledAmount = 0
  let unsettledCount = 0

  sales.forEach(sale => {
    totalSalesCount++
    grossRevenue += sale.retailPrice
    totalCommission += sale.commissionAmount
    netRevenue += sale.netAmount

    if (sale.isSettled) {
      settledAmount += sale.netAmount
    } else {
      unsettledAmount += sale.netAmount
      unsettledCount++
    }
  })

  // Calculate channel breakdown
  const channelMap = new Map<number | null, ChannelBreakdown>()

  sales.forEach(sale => {
    const key = sale.distributorId
    let channel = channelMap.get(key)

    if (!channel) {
      channel = {
        distributorId: key,
        distributorName: sale.distributorName,
        commissionPercentage: sale.commissionPercentage,
        salesCount: 0,
        grossRevenue: 0,
        totalCommission: 0,
        netRevenue: 0,
        settledAmount: 0,
        unsettledAmount: 0,
      }
      channelMap.set(key, channel)
    }

    channel.salesCount++
    channel.grossRevenue += sale.retailPrice
    channel.totalCommission += sale.commissionAmount
    channel.netRevenue += sale.netAmount

    if (sale.isSettled) {
      channel.settledAmount += sale.netAmount
    } else {
      channel.unsettledAmount += sale.netAmount
    }
  })

  const byChannel = Array.from(channelMap.values())
    .sort((a, b) => b.netRevenue - a.netRevenue)

  // Calculate monthly breakdown
  const monthMap = new Map<string, MonthlyBreakdown>()

  sales.forEach(sale => {
    const date = new Date(sale.dateSold)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    const taxYearMonth = getTaxYearMonth(date)

    let month = monthMap.get(monthKey)
    if (!month) {
      month = {
        monthKey,
        monthLabel,
        taxYearMonth,
        salesCount: 0,
        grossRevenue: 0,
        totalCommission: 0,
        netRevenue: 0,
      }
      monthMap.set(monthKey, month)
    }

    month.salesCount++
    month.grossRevenue += sale.retailPrice
    month.totalCommission += sale.commissionAmount
    month.netRevenue += sale.netAmount
  })

  const byMonth = Array.from(monthMap.values())
    .sort((a, b) => a.taxYearMonth - b.taxYearMonth)

  // Calculate quarterly breakdown
  const quarterLabels = [
    'Q1 (Apr-Jun)',
    'Q2 (Jul-Sep)',
    'Q3 (Oct-Dec)',
    'Q4 (Jan-Mar)',
  ]

  const quarterMap = new Map<number, QuarterlyBreakdown>()

  // Initialize all quarters
  for (let q = 1; q <= 4; q++) {
    quarterMap.set(q, {
      quarter: q,
      quarterLabel: quarterLabels[q - 1],
      salesCount: 0,
      grossRevenue: 0,
      totalCommission: 0,
      netRevenue: 0,
    })
  }

  sales.forEach(sale => {
    const date = new Date(sale.dateSold)
    const quarter = getTaxYearQuarter(date)
    const qData = quarterMap.get(quarter)!

    qData.salesCount++
    qData.grossRevenue += sale.retailPrice
    qData.totalCommission += sale.commissionAmount
    qData.netRevenue += sale.netAmount
  })

  const byQuarter = Array.from(quarterMap.values())

  // Calculate previous year comparison
  let previousYear: TaxYearReport['previousYear'] | undefined

  if (includePreviousYear) {
    const prevTaxYear = getTaxYear(taxYear.startYear - 1)
    const prevEditions = editions.filter(e =>
      e.is_sold && isInTaxYear(e.date_sold, prevTaxYear)
    )

    let prevGross = 0
    let prevNet = 0

    prevEditions.forEach(e => {
      const price = e.retail_price || 0
      const commission = e.commission_percentage ?? e.distributors?.commission_percentage ?? 0
      prevGross += price
      prevNet += price * (1 - commission / 100)
    })

    previousYear = {
      taxYear: prevTaxYear,
      salesCount: prevEditions.length,
      grossRevenue: prevGross,
      netRevenue: prevNet,
    }
  }

  return {
    taxYear,
    totalSalesCount,
    grossRevenue,
    totalCommission,
    netRevenue,
    settledAmount,
    unsettledAmount,
    unsettledCount,
    byChannel,
    byMonth,
    byQuarter,
    sales,
    previousYear,
  }
}

/**
 * Generate CSV content for tax year report
 */
export function generateTaxYearCSV(report: TaxYearReport): string {
  const lines: string[] = []

  // Header info
  lines.push(`UK Tax Year Report: ${report.taxYear.label}`)
  lines.push(`Period: 6 April ${report.taxYear.startYear} - 5 April ${report.taxYear.endYear}`)
  lines.push(`Generated: ${new Date().toLocaleDateString('en-GB')}`)
  lines.push('')

  // Summary
  lines.push('SUMMARY')
  lines.push(`Total Sales,${report.totalSalesCount}`)
  lines.push(`Gross Revenue,${report.grossRevenue.toFixed(2)}`)
  lines.push(`Total Commission,${report.totalCommission.toFixed(2)}`)
  lines.push(`Net Revenue,${report.netRevenue.toFixed(2)}`)
  lines.push(`Settled Amount,${report.settledAmount.toFixed(2)}`)
  lines.push(`Unsettled Amount,${report.unsettledAmount.toFixed(2)}`)
  lines.push('')

  // By Channel
  lines.push('BY CHANNEL')
  lines.push('Channel,Commission %,Sales,Gross Revenue,Commission,Net Revenue,Settled,Unsettled')
  report.byChannel.forEach(ch => {
    lines.push([
      `"${ch.distributorName}"`,
      ch.commissionPercentage,
      ch.salesCount,
      ch.grossRevenue.toFixed(2),
      ch.totalCommission.toFixed(2),
      ch.netRevenue.toFixed(2),
      ch.settledAmount.toFixed(2),
      ch.unsettledAmount.toFixed(2),
    ].join(','))
  })
  lines.push('')

  // By Quarter
  lines.push('BY QUARTER')
  lines.push('Quarter,Sales,Gross Revenue,Commission,Net Revenue')
  report.byQuarter.forEach(q => {
    lines.push([
      q.quarterLabel,
      q.salesCount,
      q.grossRevenue.toFixed(2),
      q.totalCommission.toFixed(2),
      q.netRevenue.toFixed(2),
    ].join(','))
  })
  lines.push('')

  // By Month
  lines.push('BY MONTH')
  lines.push('Month,Sales,Gross Revenue,Commission,Net Revenue')
  report.byMonth.forEach(m => {
    lines.push([
      m.monthLabel,
      m.salesCount,
      m.grossRevenue.toFixed(2),
      m.totalCommission.toFixed(2),
      m.netRevenue.toFixed(2),
    ].join(','))
  })
  lines.push('')

  // Sales Register
  lines.push('SALES REGISTER')
  lines.push('Date,Edition,Artwork,Channel,Retail Price,Commission %,Commission,Net Amount,Settled')
  report.sales.forEach(sale => {
    const date = new Date(sale.dateSold).toLocaleDateString('en-GB')
    lines.push([
      date,
      `"${sale.editionDisplayName}"`,
      `"${sale.artworkName}"`,
      `"${sale.distributorName}"`,
      sale.retailPrice.toFixed(2),
      sale.commissionPercentage,
      sale.commissionAmount.toFixed(2),
      sale.netAmount.toFixed(2),
      sale.isSettled ? 'Yes' : 'No',
    ].join(','))
  })

  return lines.join('\n')
}
