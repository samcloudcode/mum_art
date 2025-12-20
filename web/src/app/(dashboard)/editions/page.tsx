'use client'

import { useState, useMemo } from 'react'
import { EditionsTable } from './editions-table'
import { EditionFilters } from './edition-filters'
import { useInventory } from '@/lib/hooks/use-inventory'
import type { EditionFilters as EditionFiltersType } from '@/lib/types'

export default function EditionsPage() {
  const [filters, setFilters] = useState<EditionFiltersType>({})

  const {
    editions,
    prints,
    distributors,
    isReady,
    isSaving,
    markPrinted,
    moveToGallery,
  } = useInventory(filters)

  // Convert filters to the format expected by EditionFilters component
  const currentFilters = useMemo(() => ({
    search: filters.search || '',
    print: filters.printId?.toString() || '',
    distributor: filters.distributorId?.toString() || '',
    size: filters.size || '',
    frame: filters.frameType || '',
    printed: filters.isPrinted === true ? 'true' : filters.isPrinted === false ? 'false' : '',
    sold: filters.isSold === true ? 'true' : filters.isSold === false ? 'false' : '',
  }), [filters])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => {
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
          next.size = value && value !== 'all' ? value as EditionFiltersType['size'] : undefined
          break
        case 'frame':
          next.frameType = value && value !== 'all' ? value as EditionFiltersType['frameType'] : undefined
          break
        case 'printed':
          next.isPrinted = value === 'true' ? true : value === 'false' ? false : undefined
          break
        case 'sold':
          next.isSold = value === 'true' ? true : value === 'false' ? false : undefined
          break
      }

      return next
    })
  }

  const handleClearFilters = () => {
    setFilters({})
  }

  if (!isReady) {
    return null // InventoryProvider handles the loading state
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editions</h1>
          <p className="text-sm text-gray-600">
            {editions.length.toLocaleString()} editions{filters.search || filters.printId || filters.distributorId || filters.size || filters.frameType || filters.isPrinted !== undefined || filters.isSold !== undefined ? ' (filtered)' : ' total'}
          </p>
        </div>
      </div>

      <EditionFilters
        prints={prints.map(p => ({ id: p.id, name: p.name }))}
        distributors={distributors.map(d => ({ id: d.id, name: d.name }))}
        currentFilters={currentFilters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      <EditionsTable
        editions={editions}
        distributors={distributors.map(d => ({
          id: d.id,
          name: d.name,
          commission_percentage: d.commission_percentage,
        }))}
        isSaving={isSaving}
        onMarkPrinted={markPrinted}
        onMoveToGallery={moveToGallery}
      />
    </div>
  )
}
