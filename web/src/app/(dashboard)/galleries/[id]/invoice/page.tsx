'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useInventory } from '@/lib/hooks/use-inventory'
import { formatPrice, calculateNetAmount, formatDate, cn, getMonthName, getMonthDateRange } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

type PageProps = {
  params: Promise<{ id: string }>
}

export default function InvoicePage({ params }: PageProps) {
  const { id } = use(params)
  const distributorId = parseInt(id)
  const searchParams = useSearchParams()

  // Get month/year from query params, default to current month
  // Validate and clamp to valid ranges
  const now = new Date()
  const rawYear = parseInt(searchParams.get('year') || '')
  const rawMonth = parseInt(searchParams.get('month') || '')

  const year = !isNaN(rawYear) && rawYear >= 2000 && rawYear <= 2100
    ? rawYear
    : now.getFullYear()
  const month = !isNaN(rawMonth) && rawMonth >= 1 && rawMonth <= 12
    ? rawMonth
    : now.getMonth() + 1

  const { distributors, allEditions, prints, isReady } = useInventory()

  const distributor = useMemo(
    () => distributors.find((d) => d.id === distributorId),
    [distributors, distributorId]
  )

  // Filter editions sold at this gallery in the specified month
  const invoiceItems = useMemo(() => {
    const { start, end } = getMonthDateRange(year, month)

    return allEditions
      .filter((e) => {
        if (e.distributor_id !== distributorId) return false
        if (!e.is_sold || !e.date_sold) return false

        // String comparison works for ISO date format (YYYY-MM-DD)
        const saleDate = e.date_sold.split('T')[0]
        return saleDate >= start && saleDate <= end
      })
      .map((e) => {
        const print = prints.find((p) => p.id === e.print_id)
        const commission = e.commission_percentage ?? distributor?.commission_percentage ?? 0
        const commissionAmount = (e.retail_price || 0) * (commission / 100)
        const netAmount = calculateNetAmount(e.retail_price, commission)

        return {
          id: e.id,
          dateSold: e.date_sold,
          artworkName: print?.name || 'Unknown',
          editionName: e.edition_display_name,
          retailPrice: e.retail_price || 0,
          commissionPercentage: commission,
          commissionAmount,
          netAmount,
          isSettled: e.is_settled,
        }
      })
      .sort((a, b) => {
        // Sort by date, then by artwork name
        const dateCompare = (a.dateSold || '').localeCompare(b.dateSold || '')
        if (dateCompare !== 0) return dateCompare
        return a.artworkName.localeCompare(b.artworkName)
      })
  }, [allEditions, prints, distributorId, distributor, year, month])

  // Calculate totals
  const totals = useMemo(() => {
    return invoiceItems.reduce(
      (acc, item) => ({
        retail: acc.retail + item.retailPrice,
        commission: acc.commission + item.commissionAmount,
        net: acc.net + item.netAmount,
      }),
      { retail: 0, commission: 0, net: 0 }
    )
  }, [invoiceItems])

  const [isExporting, setIsExporting] = useState(false)

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    setIsExporting(true)
    try {
      // Dynamically import html2pdf (browser-only library)
      const html2pdf = (await import('html2pdf.js')).default

      const element = document.getElementById('invoice-container')
      if (!element) return

      const filename = `Invoice-${distributor?.name?.replace(/\s+/g, '-')}-${getMonthName(month)}-${year}.pdf`

      const opt = {
        margin: 10,
        filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      }

      await html2pdf().set(opt).from(element).save()
    } catch (error) {
      console.error('Failed to generate PDF:', error)
    } finally {
      setIsExporting(false)
    }
  }

  if (!isReady) return null

  if (!distributor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/galleries" className="hover:text-gray-900">Galleries</Link>
          <span>/</span>
          <span className="text-gray-900">Not Found</span>
        </div>
        <p className="text-muted-foreground">Gallery not found</p>
      </div>
    )
  }

  const invoiceDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const invoiceNumber = `INV-${distributor.id}-${year}${String(month).padStart(2, '0')}`

  return (
    <>
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the invoice */
          body * {
            visibility: hidden;
          }
          #invoice-container, #invoice-container * {
            visibility: visible;
          }
          #invoice-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20mm;
          }
          /* Hide screen-only elements */
          .no-print {
            display: none !important;
          }
          /* Ensure proper page breaks */
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>

      {/* Screen navigation - hidden when printing */}
      <div className="no-print space-y-4 mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/galleries" className="hover:text-gray-900">Galleries</Link>
          <span>/</span>
          <Link href={`/galleries/${id}`} className="hover:text-gray-900">{distributor.name}</Link>
          <span>/</span>
          <span className="text-gray-900">Invoice</span>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Invoice Preview</h1>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/galleries/${id}`}>Back to Gallery</Link>
            </Button>
            <Button variant="outline" onClick={handlePrint}>Print Invoice</Button>
            <Button onClick={handleDownloadPDF} disabled={isExporting}>
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice container - this is what gets printed */}
      <div id="invoice-container" className="bg-white p-8 border rounded-lg shadow-sm max-w-4xl mx-auto">
        {/* Header */}
        <div className="border-b pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
              <p className="text-gray-600 mt-1">Sales Statement</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Invoice Number</p>
              <p className="font-mono font-semibold">{invoiceNumber}</p>
              <p className="text-sm text-gray-600 mt-2">Date</p>
              <p className="font-semibold">{invoiceDate}</p>
            </div>
          </div>
        </div>

        {/* Gallery Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Bill To</h2>
            <p className="font-semibold text-lg">{distributor.name}</p>
            {distributor.contact_number && (
              <p className="text-gray-600">{distributor.contact_number}</p>
            )}
            {distributor.web_address && (
              <p className="text-gray-600 text-sm">{distributor.web_address}</p>
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Period</h2>
            <p className="font-semibold text-lg">{getMonthName(month)} {year}</p>
            <p className="text-gray-600">Commission Rate: {distributor.commission_percentage ?? 0}%</p>
          </div>
        </div>

        {/* Line Items */}
        {invoiceItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500 border rounded">
            No sales recorded for {getMonthName(month)} {year}
          </div>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Artwork</th>
                  <th className="text-left py-3 px-4 font-semibold">Edition</th>
                  <th className="text-right py-3 px-4 font-semibold">Retail</th>
                  <th className="text-right py-3 px-4 font-semibold">Commission</th>
                  <th className="text-right py-3 px-4 font-semibold">Net Due</th>
                  <th className="text-center py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-t',
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    )}
                  >
                    <td className="py-3 px-4">{formatDate(item.dateSold)}</td>
                    <td className="py-3 px-4 font-medium">{item.artworkName}</td>
                    <td className="py-3 px-4 text-gray-600">{item.editionName}</td>
                    <td className="py-3 px-4 text-right">{formatPrice(item.retailPrice)}</td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {formatPrice(item.commissionAmount)}
                      <span className="text-xs text-gray-400 ml-1">({item.commissionPercentage}%)</span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{formatPrice(item.netAmount)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded text-xs font-medium',
                        item.isSettled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      )}>
                        {item.isSettled ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-semibold">
                <tr className="border-t-2">
                  <td colSpan={3} className="py-3 px-4">
                    Total ({invoiceItems.length} {invoiceItems.length === 1 ? 'sale' : 'sales'})
                  </td>
                  <td className="py-3 px-4 text-right">{formatPrice(totals.retail)}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{formatPrice(totals.commission)}</td>
                  <td className="py-3 px-4 text-right">{formatPrice(totals.net)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Summary */}
        {invoiceItems.length > 0 && (
          <div className="mt-8 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Total Retail:</span>
                <span>{formatPrice(totals.retail)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Gallery Commission:</span>
                <span className="text-gray-600">-{formatPrice(totals.commission)}</span>
              </div>
              <div className="flex justify-between py-2 text-lg font-bold">
                <span>Net Due to Artist:</span>
                <span>{formatPrice(totals.net)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-center text-sm text-gray-500">
          <p>Thank you for your partnership.</p>
        </div>
      </div>
    </>
  )
}
