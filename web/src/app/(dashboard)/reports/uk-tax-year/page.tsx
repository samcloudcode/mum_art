'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { formatPrice } from '@/lib/utils'
import {
  getCurrentTaxYear,
  getAvailableTaxYears,
  calculateTaxYearReport,
  generateTaxYearCSV,
  type TaxYear,
  type TaxYearReport,
} from '@/lib/utils/uk-tax-year'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function UKTaxYearReportPage() {
  const { allEditions, distributors, isReady } = useInventory()
  const [selectedTaxYear, setSelectedTaxYear] = useState<TaxYear | null>(null)
  const [showSalesRegister, setShowSalesRegister] = useState(false)

  // Get available tax years
  const availableTaxYears = useMemo(
    () => getAvailableTaxYears(allEditions),
    [allEditions]
  )

  // Use current tax year as default
  const currentTaxYear = useMemo(() => getCurrentTaxYear(), [])
  const activeTaxYear = selectedTaxYear || currentTaxYear

  // Calculate report
  const report = useMemo(
    () => calculateTaxYearReport(allEditions, distributors, activeTaxYear),
    [allEditions, distributors, activeTaxYear]
  )

  // Handle CSV export
  const handleExportCSV = () => {
    const csv = generateTaxYearCSV(report)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `uk-tax-year-${report.taxYear.label}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (!isReady) return null

  // Calculate year-over-year changes
  const yoyChange = report.previousYear ? {
    salesChange: report.previousYear.salesCount > 0
      ? ((report.totalSalesCount - report.previousYear.salesCount) / report.previousYear.salesCount) * 100
      : report.totalSalesCount > 0 ? 100 : 0,
    revenueChange: report.previousYear.netRevenue > 0
      ? ((report.netRevenue - report.previousYear.netRevenue) / report.previousYear.netRevenue) * 100
      : report.netRevenue > 0 ? 100 : 0,
  } : null

  return (
    <div className="space-y-10">
      {/* Page header */}
      <header className="border-b border-border pb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
              Tax Reports
            </p>
            <h1 className="text-foreground mb-2">UK Tax Year Report</h1>
            <p className="text-muted-foreground text-lg font-light">
              Income summary for Self Assessment
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Tax year selector */}
            <select
              value={activeTaxYear.startYear}
              onChange={(e) => {
                const year = parseInt(e.target.value)
                const taxYear = availableTaxYears.find(ty => ty.startYear === year)
                setSelectedTaxYear(taxYear || null)
              }}
              className="px-4 py-2 border border-border rounded-sm bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {availableTaxYears.map(ty => (
                <option key={ty.startYear} value={ty.startYear}>
                  {ty.label}
                </option>
              ))}
            </select>

            {/* Export button */}
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-sm text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Period indicator */}
        <p className="text-sm text-muted-foreground mt-4">
          Period: 6 April {activeTaxYear.startYear} – 5 April {activeTaxYear.endYear}
        </p>
      </header>

      {/* Income Summary */}
      <section>
        <h2 className="text-foreground mb-6">Income Summary</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Gross Sales Revenue
            </p>
            <p className="stat-value text-foreground">
              {formatPrice(report.grossRevenue)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {report.totalSalesCount} sales
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Gallery Commissions
            </p>
            <p className="stat-value text-red-600">
              ({formatPrice(report.totalCommission)})
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Paid to galleries
            </p>
          </div>

          <div className="gallery-plaque border-l-4 border-accent">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Net Taxable Income
            </p>
            <p className="stat-value text-foreground">
              {formatPrice(report.netRevenue)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              After commission
            </p>
          </div>

          <div className="gallery-plaque">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Settlement Status
            </p>
            <p className="stat-value text-foreground">
              {formatPrice(report.settledAmount)}
            </p>
            {report.unsettledCount > 0 && (
              <p className="text-sm text-amber-600 mt-2">
                {formatPrice(report.unsettledAmount)} unsettled ({report.unsettledCount})
              </p>
            )}
            {report.unsettledCount === 0 && (
              <p className="text-sm text-green-600 mt-2">
                All payments received
              </p>
            )}
          </div>
        </div>

        {/* Year-over-year comparison */}
        {report.previousYear && report.previousYear.salesCount > 0 && (
          <div className="mt-6 p-4 bg-muted/30 rounded-sm">
            <p className="text-sm text-muted-foreground mb-2">
              Compared to {report.previousYear.taxYear.label}:
            </p>
            <div className="flex gap-8">
              <div>
                <span className="text-sm font-medium">Sales: </span>
                <span className={`text-sm ${yoyChange!.salesChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {yoyChange!.salesChange >= 0 ? '+' : ''}{yoyChange!.salesChange.toFixed(1)}%
                </span>
                <span className="text-sm text-muted-foreground ml-1">
                  ({report.previousYear.salesCount} → {report.totalSalesCount})
                </span>
              </div>
              <div>
                <span className="text-sm font-medium">Net Revenue: </span>
                <span className={`text-sm ${yoyChange!.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {yoyChange!.revenueChange >= 0 ? '+' : ''}{yoyChange!.revenueChange.toFixed(1)}%
                </span>
                <span className="text-sm text-muted-foreground ml-1">
                  ({formatPrice(report.previousYear.netRevenue)} → {formatPrice(report.netRevenue)})
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* By Sales Channel */}
      <section>
        <h2 className="text-foreground mb-6">By Sales Channel</h2>
        {report.byChannel.length > 0 ? (
          <div className="border border-border rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Gross Revenue</TableHead>
                  <TableHead className="text-right">Commission Paid</TableHead>
                  <TableHead className="text-right">Net Revenue</TableHead>
                  <TableHead className="text-right">Unsettled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byChannel.map(channel => (
                  <TableRow key={channel.distributorId ?? 'direct'}>
                    <TableCell>
                      {channel.distributorId ? (
                        <Link
                          href={`/galleries/${channel.distributorId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {channel.distributorName}
                        </Link>
                      ) : (
                        <span className="font-medium">{channel.distributorName}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {channel.commissionPercentage}%
                    </TableCell>
                    <TableCell className="text-right">
                      {channel.salesCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(channel.grossRevenue)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {channel.totalCommission > 0 ? `(${formatPrice(channel.totalCommission)})` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(channel.netRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {channel.unsettledAmount > 0 ? (
                        <span className="text-amber-600">
                          {formatPrice(channel.unsettledAmount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted/30 font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">{report.totalSalesCount}</TableCell>
                  <TableCell className="text-right">{formatPrice(report.grossRevenue)}</TableCell>
                  <TableCell className="text-right text-red-600">
                    ({formatPrice(report.totalCommission)})
                  </TableCell>
                  <TableCell className="text-right">{formatPrice(report.netRevenue)}</TableCell>
                  <TableCell className="text-right">
                    {report.unsettledAmount > 0 ? (
                      <span className="text-amber-600">{formatPrice(report.unsettledAmount)}</span>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground">No sales in this tax year.</p>
        )}
      </section>

      {/* Quarterly and Monthly Breakdown */}
      <div className="grid lg:grid-cols-2 gap-10">
        {/* Quarterly */}
        <section>
          <h2 className="text-foreground mb-6">Quarterly Breakdown</h2>
          <div className="border border-border rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quarter</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byQuarter.map(q => (
                  <TableRow key={q.quarter}>
                    <TableCell>{q.quarterLabel}</TableCell>
                    <TableCell className="text-right">{q.salesCount}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatPrice(q.grossRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(q.netRevenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Monthly */}
        <section>
          <h2 className="text-foreground mb-6">Monthly Breakdown</h2>
          <div className="border border-border rounded-sm overflow-hidden max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byMonth.length > 0 ? (
                  report.byMonth.map(m => (
                    <TableRow key={m.monthKey}>
                      <TableCell>{m.monthLabel}</TableCell>
                      <TableCell className="text-right">{m.salesCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatPrice(m.grossRevenue)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(m.netRevenue)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No sales in this tax year
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      {/* Sales Register (collapsible) */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-foreground">Sales Register</h2>
          <button
            onClick={() => setShowSalesRegister(!showSalesRegister)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showSalesRegister ? 'Hide Details' : `Show All ${report.sales.length} Sales`}
          </button>
        </div>

        {showSalesRegister && (
          <div className="border border-border rounded-sm overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Edition</TableHead>
                    <TableHead>Artwork</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Retail</TableHead>
                    <TableHead className="text-right">Comm.</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-center">Settled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.sales.map(sale => (
                    <TableRow key={sale.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(sale.dateSold).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/editions/${sale.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {sale.editionDisplayName}
                        </Link>
                      </TableCell>
                      <TableCell>{sale.artworkName}</TableCell>
                      <TableCell>{sale.distributorName}</TableCell>
                      <TableCell className="text-right">
                        {formatPrice(sale.retailPrice)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {sale.commissionPercentage}%
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(sale.netAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {sale.isSettled ? (
                          <span className="text-green-600">Yes</span>
                        ) : (
                          <span className="text-amber-600">No</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {!showSalesRegister && report.sales.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {report.sales.length} sales recorded. Click "Show All" to view the complete register.
          </p>
        )}
      </section>

      {/* Notes for accountant */}
      <section className="bg-muted/30 p-6 rounded-sm">
        <h3 className="text-foreground font-medium mb-4">Notes for Tax Return</h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>
            <strong>Gross Revenue:</strong> Total retail value of all sales made during the tax year.
          </li>
          <li>
            <strong>Gallery Commissions:</strong> Amounts paid to galleries can be claimed as a business expense (cost of sales).
          </li>
          <li>
            <strong>Net Revenue:</strong> This is the income after gallery commissions – the amount to report as self-employment income.
          </li>
          <li>
            <strong>Settlement Status:</strong> For cash basis accounting, only include income that has been received.
            The "unsettled" amount indicates sales where payment is still pending from galleries.
          </li>
        </ul>
      </section>
    </div>
  )
}
