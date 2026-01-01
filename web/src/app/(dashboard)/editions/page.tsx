'use client'

import { useState, useMemo, useTransition } from 'react'
import { EditionsDataTable } from '@/components/editions/editions-data-table'
import { EditionFilters } from './edition-filters'
import { useInventory } from '@/lib/hooks/use-inventory'
import { cn } from '@/lib/utils'
import type { EditionFilters as EditionFiltersType } from '@/lib/types'

export default function EditionsPage() {
  const [filters, setFilters] = useState<EditionFiltersType>({})
  const [isPending, startTransition] = useTransition()

  const {
    editions,
    prints,
    distributors,
    sizes,
    legacyCount,
    isReady,
    isSaving,
    savingIds,
    update,
    updateMany,
    markPrinted,
    markSold,
    markSettled,
    moveToGallery,
  } = useInventory(filters)

  // Memoize options arrays to prevent unnecessary re-renders of EditionFilters
  const printOptions = useMemo(
    () => prints.map((p) => ({ id: p.id, name: p.name })),
    [prints]
  )
  const distributorOptions = useMemo(
    () => distributors.map((d) => ({ id: d.id, name: d.name })),
    [distributors]
  )

  // Convert filters to the format expected by EditionFilters component
  const currentFilters = useMemo(
    () => ({
      search: filters.search || '',
      print: filters.printId?.toString() || '',
      distributor: filters.distributorId?.toString() || '',
      size: filters.size || '',
      frame: filters.frameType || '',
      printed:
        filters.isPrinted === true ? 'true' : filters.isPrinted === false ? 'false' : '',
      sold: filters.isUnsettled
        ? 'unpaid'
        : filters.isSold === true
          ? 'true'
          : filters.isSold === false
            ? 'false'
            : '',
      includeLegacy: filters.includeLegacy ? 'true' : 'false',
    }),
    [filters]
  )

  const handleFilterChange = (key: string, value: string) => {
    // Use startTransition to mark filter updates as non-urgent
    // This keeps the UI responsive while the table re-renders
    startTransition(() => {
      setFilters((prev) => {
        const next = { ...prev }

        switch (key) {
          case 'search':
            next.search = value || undefined
            break
          case 'print':
            next.printId = value && value !== 'all' ? parseInt(value) : undefined
            break
          case 'distributor':
            next.distributorId = value && value !== 'all' ? parseInt(value) : undefined
            break
          case 'size':
            next.size =
              value && value !== 'all' ? (value as EditionFiltersType['size']) : undefined
            break
          case 'frame':
            next.frameType =
              value && value !== 'all' ? (value as EditionFiltersType['frameType']) : undefined
            break
          case 'printed':
            next.isPrinted = value === 'true' ? true : value === 'false' ? false : undefined
            break
          case 'sold':
            // Handle the special "unpaid" value
            if (value === 'unpaid') {
              next.isSold = undefined
              next.isUnsettled = true
            } else {
              next.isUnsettled = undefined
              next.isSold = value === 'true' ? true : value === 'false' ? false : undefined
            }
            break
          case 'includeLegacy':
            next.includeLegacy = value === 'true'
            break
        }

        return next
      })
    })
  }

  const handleClearFilters = () => {
    setFilters({})
  }

  if (!isReady) {
    return null // InventoryProvider handles the loading state
  }

  const hasActiveFilters =
    filters.search ||
    filters.printId ||
    filters.distributorId ||
    filters.size ||
    filters.frameType ||
    filters.isPrinted !== undefined ||
    filters.isSold !== undefined ||
    filters.isUnsettled

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editions</h1>
          <p className="text-sm text-gray-600">
            {editions.length.toLocaleString()} editions
            {hasActiveFilters ? ' (filtered)' : ' total'}
          </p>
        </div>
      </div>

      <EditionFilters
        prints={printOptions}
        distributors={distributorOptions}
        currentFilters={currentFilters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        legacyCount={legacyCount}
      />

      <div className={cn('transition-opacity duration-150', isPending && 'opacity-60')}>
        <EditionsDataTable
          editions={editions}
          distributors={distributors}
          sizes={sizes}
          showSelection={true}
          showPagination={true}
          showExpandableRows={true}
          enableInlineEdit={true}
          onUpdate={update}
          onBulkUpdate={updateMany}
          onMarkSold={markSold}
          onMarkSettled={markSettled}
          onMoveToGallery={moveToGallery}
          onMarkPrinted={markPrinted}
          isSaving={isSaving}
          savingIds={savingIds}
        />
      </div>
    </div>
  )
}
