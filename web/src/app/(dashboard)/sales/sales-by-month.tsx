'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { paymentStatusStyles } from '@/lib/utils/badge-styles'
import { Badge } from '@/components/ui/badge'
import { PaymentStatusSelect } from '@/components/editions/edition-status-selects'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useInventory } from '@/lib/hooks/use-inventory'

type Sale = {
  id: number
  edition_display_name: string
  retail_price: number | null
  date_sold: string | null
  is_settled: boolean | null
  commission_percentage: number | null
  prints: { id: number; name: string } | null
  distributors: { id: number; name: string; commission_percentage: number | null } | null
}

type MonthData = {
  key: string
  month: string
  year: number
  sales: Sale[]
  totalRetail: number
  totalNet: number
  unsettledNet: number
  unsettledCount: number
}

type Props = {
  monthlyData: MonthData[]
}

export function SalesByMonth({ monthlyData }: Props) {
  const { markSettled, update, isSaving } = useInventory()
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    // Auto-expand first month if there are unsettled sales
    new Set(monthlyData.length > 0 && monthlyData[0].unsettledCount > 0 ? [monthlyData[0].key] : [])
  )
  const [selectedSales, setSelectedSales] = useState<Map<string, Set<number>>>(new Map())
  // Track local status overrides for optimistic UI updates
  // Maps sale ID -> updated is_settled value
  const [statusOverrides, setStatusOverrides] = useState<Map<number, boolean>>(new Map())

  const toggleMonth = (key: string) => {
    const newExpanded = new Set(expandedMonths)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedMonths(newExpanded)
  }

  const toggleSaleSelection = (monthKey: string, saleId: number) => {
    const newSelected = new Map(selectedSales)
    const monthSelection = new Set(newSelected.get(monthKey) || [])
    if (monthSelection.has(saleId)) {
      monthSelection.delete(saleId)
    } else {
      monthSelection.add(saleId)
    }
    newSelected.set(monthKey, monthSelection)
    setSelectedSales(newSelected)
  }

  const selectAllUnsettled = (monthKey: string, sales: Sale[]) => {
    const newSelected = new Map(selectedSales)
    const unsettledIds = sales.filter((s) => !s.is_settled).map((s) => s.id)
    newSelected.set(monthKey, new Set(unsettledIds))
    setSelectedSales(newSelected)
  }

  const clearSelection = (monthKey: string) => {
    const newSelected = new Map(selectedSales)
    newSelected.delete(monthKey)
    setSelectedSales(newSelected)
  }

  const handleMarkAsPaid = async (monthKey: string) => {
    const saleIds = Array.from(selectedSales.get(monthKey) || [])
    if (saleIds.length === 0) return

    const success = await markSettled(saleIds)
    if (success) {
      // Update local overrides for immediate UI feedback
      setStatusOverrides(prev => {
        const next = new Map(prev)
        saleIds.forEach(id => next.set(id, true))
        return next
      })
      clearSelection(monthKey)
    }
  }

  const handleToggleSettled = useCallback(async (id: number, isSettled: boolean): Promise<boolean> => {
    const success = await update(id, { is_settled: isSettled })
    if (success) {
      // Update local override for immediate UI feedback
      setStatusOverrides(prev => new Map(prev).set(id, isSettled))
    }
    return success
  }, [update])

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return `£${price.toLocaleString()}`
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  // Group sales by distributor within a month
  const groupByDistributor = (sales: Sale[]) => {
    const groups = new Map<string, { distributor: Sale['distributors']; sales: Sale[] }>()
    sales.forEach((sale) => {
      const key = sale.distributors?.name || 'Direct'
      const current = groups.get(key) || { distributor: sale.distributors, sales: [] }
      current.sales.push(sale)
      groups.set(key, current)
    })
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }

  return (
    <div className="space-y-4">
      {monthlyData.map((monthData) => {
        const isExpanded = expandedMonths.has(monthData.key)
        const monthSelection = selectedSales.get(monthData.key) || new Set()
        const distributorGroups = groupByDistributor(monthData.sales)

        return (
          <div
            key={monthData.key}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
          >
            {/* Month header */}
            <button
              onClick={() => toggleMonth(monthData.key)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="text-lg font-semibold">{monthData.month}</span>
                <span className="text-sm text-gray-600">
                  {monthData.sales.length} sales
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    Retail: {formatPrice(monthData.totalRetail)}
                  </p>
                  <p className="text-sm font-medium">
                    Net: {formatPrice(monthData.totalNet)}
                  </p>
                </div>
                {monthData.unsettledCount > 0 && (
                  <Badge className={paymentStatusStyles.unpaid.badge}>
                    {formatPrice(monthData.unsettledNet)} unsettled
                  </Badge>
                )}
                <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-gray-200">
                {/* Selection actions */}
                {monthSelection.size > 0 && (
                  <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-blue-700">
                      {monthSelection.size} sale{monthSelection.size > 1 ? 's' : ''} selected
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsPaid(monthData.key)}
                        disabled={isSaving}
                      >
                        {isSaving ? 'Updating...' : 'Mark as Paid'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clearSelection(monthData.key)}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}

                {/* Sales grouped by distributor */}
                <div className="divide-y divide-gray-100">
                  {distributorGroups.map(([distName, group]) => {
                    const unsettledInGroup = group.sales.filter((s) => !s.is_settled)
                    const groupNetTotal = group.sales.reduce((sum, s) => {
                      const commission = s.commission_percentage || s.distributors?.commission_percentage || 0
                      return sum + (s.retail_price || 0) * (1 - commission / 100)
                    }, 0)

                    return (
                      <div key={distName} className="px-4 py-3">
                        {/* Distributor header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{distName}</span>
                            {group.distributor?.commission_percentage !== null && (
                              <span className="text-xs text-gray-500">
                                ({group.distributor?.commission_percentage}%)
                              </span>
                            )}
                            <span className="text-sm text-gray-600">
                              {group.sales.length} sales | {formatPrice(groupNetTotal)} net
                            </span>
                          </div>
                          {unsettledInGroup.length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => selectAllUnsettled(monthData.key, group.sales)}
                            >
                              Select Unsettled ({unsettledInGroup.length})
                            </Button>
                          )}
                        </div>

                        {/* Sales table */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10"></TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Edition</TableHead>
                              <TableHead>Artwork</TableHead>
                              <TableHead className="text-right">Retail</TableHead>
                              <TableHead className="text-right">Net</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.sales.map((sale) => {
                              const commission = sale.commission_percentage || sale.distributors?.commission_percentage || 0
                              const net = (sale.retail_price || 0) * (1 - commission / 100)
                              const isSelected = monthSelection.has(sale.id)
                              // Use local override if available, otherwise use prop value
                              const isSettled = statusOverrides.has(sale.id)
                                ? statusOverrides.get(sale.id)!
                                : (sale.is_settled ?? false)

                              return (
                                <TableRow key={sale.id}>
                                  <TableCell>
                                    {!isSettled && (
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() =>
                                          toggleSaleSelection(monthData.key, sale.id)
                                        }
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-gray-600">
                                    {formatDate(sale.date_sold)}
                                  </TableCell>
                                  <TableCell>
                                    <Link
                                      href={`/editions/${sale.id}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      {sale.edition_display_name}
                                    </Link>
                                  </TableCell>
                                  <TableCell>
                                    {sale.prints ? (
                                      <Link
                                        href={`/artworks/${sale.prints.id}`}
                                        className="hover:underline"
                                      >
                                        {sale.prints.name}
                                      </Link>
                                    ) : (
                                      '-'
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatPrice(sale.retail_price)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatPrice(net)}
                                  </TableCell>
                                  <TableCell>
                                    <PaymentStatusSelect
                                      saleId={sale.id}
                                      isSettled={isSettled}
                                      onToggle={handleToggleSettled}
                                    />
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {monthlyData.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No sales recorded yet
        </div>
      )}
    </div>
  )
}
