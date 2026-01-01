'use client'

import { useState, useMemo, useTransition, useEffect } from 'react'
import { EditionsDataTable } from '@/components/editions/editions-data-table'
import { MobileEditionList } from '@/components/editions/mobile-edition-list'
import { EditionFilters } from './edition-filters'
import { useInventory } from '@/lib/hooks/use-inventory'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { LayoutGrid, LayoutList } from 'lucide-react'
import type { EditionFilters as EditionFiltersType } from '@/lib/types'

type ViewMode = 'table' | 'cards'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return isMobile
}

export default function EditionsPage() {
  const [filters, setFilters] = useState<EditionFiltersType>({})
  const isMobile = useIsMobile()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
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

  // Auto-switch to cards on mobile
  const effectiveViewMode = isMobile ? 'cards' : viewMode

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
        {/* View toggle - hidden on mobile since it auto-switches */}
        <div className="hidden md:flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="gap-2"
          >
            <LayoutList className="h-4 w-4" />
            Table
          </Button>
          <Button
            variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('cards')}
            className="gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </Button>
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
        {effectiveViewMode === 'cards' ? (
          <MobileEditionList
            editions={editions}
            distributors={distributors}
            onUpdate={update}
            onBulkUpdate={updateMany}
            onMarkSold={markSold}
            onMarkSettled={markSettled}
            onMoveToGallery={moveToGallery}
            onMarkPrinted={markPrinted}
            isSaving={isSaving}
          />
        ) : (
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
        )}
      </div>
    </div>
  )
}
