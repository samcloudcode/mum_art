'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { EditionsDataTable } from './editions-data-table'
import {
  type EditionsTablePreset,
  type ColumnKey,
  type FilterKey,
  type SortOption,
  type PreFilter,
  applyPreFilter,
  sortEditions,
} from '@/lib/editions-presets'
import { formatPrice, calculateNetAmount, cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { EditionRowActions } from '@/components/edition-row-actions'
import { Search, X, Loader2 } from 'lucide-react'
import type { EditionWithRelations, Distributor } from '@/lib/types'

type ToggleOption = {
  value: string
  label: string
}

function ToggleButtonGroup({
  options,
  value,
  onChange,
  className,
}: {
  options: ToggleOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const [internalValue, setInternalValue] = useState(value)

  useEffect(() => {
    setInternalValue(value)
  }, [value])

  const handleClick = (newValue: string) => {
    flushSync(() => setInternalValue(newValue))
    onChange(newValue)
  }

  return (
    <div className={cn('flex rounded-lg border border-gray-200 overflow-hidden', className)}>
      {options.map((option, index) => (
        <button
          key={option.value}
          onClick={() => handleClick(option.value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium transition-colors duration-75',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
            internalValue === option.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50',
            index > 0 && 'border-l border-gray-200'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const printedOptions: ToggleOption[] = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Printed' },
  { value: 'false', label: 'Not Printed' },
]

const soldOptions: ToggleOption[] = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Sold' },
  { value: 'false', label: 'Available' },
  { value: 'unpaid', label: 'Unpaid' },
]

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Edition Name' },
  { value: 'artwork', label: 'Artwork' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'size', label: 'Size' },
  { value: 'date-sold', label: 'Date Sold' },
]

// Map of standard data table columns
const STANDARD_COLUMNS: ColumnKey[] = [
  'edition', 'artwork', 'size', 'frame', 'location', 'price', 'printed', 'sale', 'actions'
]

type Props = EditionsTablePreset & {
  /** Card title */
  title?: string
  /** Card description */
  description?: string
  /** Header actions (buttons, etc) */
  headerActions?: React.ReactNode
  /** Show as card with header, or bare table */
  showCard?: boolean
  /** Max height for scrolling (e.g., '400px') */
  maxHeight?: string
  /** Show filtered results summary */
  showResultsSummary?: boolean
  /** Callback when stock value changes (for displaying in parent) */
  onStockValueChange?: (value: number) => void
  /** Get distributor for computing net amounts (for unsettled view) */
  distributor?: Distributor
}

export function EditionsTableWithFilters({
  // Preset config
  preFilter,
  columns = STANDARD_COLUMNS,
  showFilters = [],
  showSelection = true,
  showPagination = true,
  showExpandableRows = true,
  enableInlineEdit = true,
  pageSize = 50,
  defaultSort = 'name',
  showSortControl = false,
  maxRows,
  // Component-level props
  title,
  description,
  headerActions,
  showCard = true,
  maxHeight,
  showResultsSummary = false,
  onStockValueChange,
  distributor,
}: Props) {
  const {
    allEditions,
    prints,
    distributors,
    sizes,
    isReady,
    isSaving,
    update,
    updateMany,
    markSold,
    markSettled,
    markPrinted,
    moveToGallery,
    updateSize,
  } = useInventory()

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [artworkFilter, setArtworkFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [sizeFilter, setSizeFilter] = useState<string>('all')
  const [frameFilter, setFrameFilter] = useState<string>('all')
  const [printedFilter, setPrintedFilter] = useState<string>('all')
  const [soldFilter, setSoldFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>(defaultSort)

  // Debounce search
  useEffect(() => {
    if (searchTerm !== debouncedSearch) {
      setIsSearching(true)
    }
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm, debouncedSearch])

  // Apply pre-filter first
  const preFiltered = useMemo(
    () => applyPreFilter(allEditions, preFilter),
    [allEditions, preFilter]
  )

  // Apply user filters
  const userFiltered = useMemo(() => {
    let result = [...preFiltered]

    // Search filter
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase()
      result = result.filter(
        (e) =>
          e.edition_display_name.toLowerCase().includes(term) ||
          e.prints?.name.toLowerCase().includes(term)
      )
    }

    // Artwork filter
    if (artworkFilter !== 'all') {
      result = result.filter((e) => e.print_id === parseInt(artworkFilter))
    }

    // Location filter
    if (locationFilter !== 'all') {
      result = result.filter((e) => e.distributor_id === parseInt(locationFilter))
    }

    // Size filter
    if (sizeFilter !== 'all') {
      result = result.filter((e) => e.size === sizeFilter)
    }

    // Frame filter
    if (frameFilter !== 'all') {
      result = result.filter((e) => e.frame_type === frameFilter)
    }

    // Printed filter
    if (printedFilter === 'true') {
      result = result.filter((e) => e.is_printed)
    } else if (printedFilter === 'false') {
      result = result.filter((e) => !e.is_printed)
    }

    // Sold filter
    if (soldFilter === 'true') {
      result = result.filter((e) => e.is_sold)
    } else if (soldFilter === 'false') {
      result = result.filter((e) => !e.is_sold)
    } else if (soldFilter === 'unpaid') {
      result = result.filter((e) => e.is_sold && !e.is_settled)
    }

    return result
  }, [preFiltered, debouncedSearch, artworkFilter, locationFilter, sizeFilter, frameFilter, printedFilter, soldFilter])

  // Apply sorting
  const sorted = useMemo(
    () => sortEditions(userFiltered, sortBy),
    [userFiltered, sortBy]
  )

  // Apply max rows limit
  const finalEditions = useMemo(
    () => (maxRows ? sorted.slice(0, maxRows) : sorted),
    [sorted, maxRows]
  )

  // Calculate stock value
  const stockValue = useMemo(
    () => finalEditions.reduce((sum, e) => sum + (e.retail_price || 0), 0),
    [finalEditions]
  )

  // Notify parent of stock value changes
  useEffect(() => {
    onStockValueChange?.(stockValue)
  }, [stockValue, onStockValueChange])

  // Get available filter options based on pre-filtered data
  const availableSizes = useMemo(() => {
    const sizeSet = new Set(preFiltered.map((e) => e.size).filter(Boolean))
    return Array.from(sizeSet).sort() as string[]
  }, [preFiltered])

  const availableFrameTypes = useMemo(() => {
    const frameSet = new Set(preFiltered.map((e) => e.frame_type).filter(Boolean))
    return Array.from(frameSet).sort() as string[]
  }, [preFiltered])

  const hasActiveFilters =
    debouncedSearch ||
    artworkFilter !== 'all' ||
    locationFilter !== 'all' ||
    sizeFilter !== 'all' ||
    frameFilter !== 'all' ||
    printedFilter !== 'all' ||
    soldFilter !== 'all'

  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setDebouncedSearch('')
    setArtworkFilter('all')
    setLocationFilter('all')
    setSizeFilter('all')
    setFrameFilter('all')
    setPrintedFilter('all')
    setSoldFilter('all')
  }, [])

  if (!isReady) return null

  // Check if we're using the special unsettled columns (dateSold, netDue)
  const isUnsettledView = columns.includes('dateSold') || columns.includes('netDue')

  // Map columns to standard EditionsDataTable columns (filtering out special ones)
  // Memoized to prevent re-renders when filter state changes
  const tableColumns = useMemo(
    () => columns.filter(
      (c): c is Exclude<ColumnKey, 'dateSold' | 'netDue'> =>
        STANDARD_COLUMNS.includes(c)
    ),
    [columns]
  )

  // Render filters
  const renderFilters = () => {
    if (showFilters.length === 0 && !showSortControl) return null

    const hasQuickToggles = showFilters.includes('printed') || showFilters.includes('sold')
    const hasDropdowns = showFilters.some((f) => !['printed', 'sold'].includes(f)) || showSortControl

    return (
      <div className="space-y-4">
        {/* Quick toggle filters */}
        {hasQuickToggles && (
          <div className="flex flex-wrap items-center gap-4">
            {showFilters.includes('printed') && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Printed:</span>
                <ToggleButtonGroup
                  options={printedOptions}
                  value={printedFilter}
                  onChange={setPrintedFilter}
                />
              </div>
            )}
            {showFilters.includes('sold') && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Sold:</span>
                <ToggleButtonGroup
                  options={soldOptions}
                  value={soldFilter}
                  onChange={setSoldFilter}
                />
              </div>
            )}
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {/* Dropdown filters and search */}
        {hasDropdowns && (
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            {showFilters.includes('search') && (
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search editions or artworks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn('pl-9', isSearching && 'pr-8')}
                />
                {isSearching && (
                  <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
            )}

            {/* Artwork filter */}
            {showFilters.includes('artwork') && (
              <Select value={artworkFilter} onValueChange={setArtworkFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Artwork" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Artworks</SelectItem>
                  {prints.map((print) => (
                    <SelectItem key={print.id} value={print.id.toString()}>
                      {print.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Location filter */}
            {showFilters.includes('location') && (
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {distributors.map((dist) => (
                    <SelectItem key={dist.id} value={dist.id.toString()}>
                      {dist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Size filter */}
            {showFilters.includes('size') && (
              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  {availableSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Frame filter */}
            {showFilters.includes('frame') && (
              <Select value={frameFilter} onValueChange={setFrameFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Frame" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frames</SelectItem>
                  {availableFrameTypes.map((frame) => (
                    <SelectItem key={frame} value={frame}>
                      {frame}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Sort */}
            {showSortControl && (
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Clear filters (if no quick toggles shown) */}
            {!hasQuickToggles && hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  // Render results summary
  const renderResultsSummary = () => {
    if (!showResultsSummary || !hasActiveFilters) return null

    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <span className="text-sm text-blue-700">
          Showing {finalEditions.length} of {preFiltered.length} editions
          {finalEditions.length > 0 && (
            <> • Filtered value: {formatPrice(stockValue)}</>
          )}
        </span>
      </div>
    )
  }

  // For unsettled view, use a custom table with special columns
  const renderUnsettledTable = () => {
    const formatDate = (date: string | null) => {
      if (!date) return '-'
      return new Date(date).toLocaleDateString('en-GB')
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            {showSelection && <TableHead className="w-12" />}
            <TableHead>Edition</TableHead>
            {columns.includes('artwork') && <TableHead>Artwork</TableHead>}
            {columns.includes('dateSold') && <TableHead>Date Sold</TableHead>}
            {columns.includes('price') && <TableHead className="text-right">Sale Price</TableHead>}
            {columns.includes('netDue') && <TableHead className="text-right">Net Due</TableHead>}
            {columns.includes('actions') && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {finalEditions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={
                  (showSelection ? 1 : 0) +
                  2 +
                  (columns.includes('artwork') ? 1 : 0) +
                  (columns.includes('dateSold') ? 1 : 0) +
                  (columns.includes('netDue') ? 1 : 0) +
                  (columns.includes('actions') ? 1 : 0)
                }
                className="text-center py-8 text-gray-500"
              >
                No unsettled sales
              </TableCell>
            </TableRow>
          ) : (
            finalEditions.map((edition) => {
              const commission =
                edition.commission_percentage ?? distributor?.commission_percentage
              const netDue = calculateNetAmount(edition.retail_price, commission)

              return (
                <TableRow key={edition.id} className="group">
                  {showSelection && (
                    <TableCell>
                      <Checkbox />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link
                      href={`/editions/${edition.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {edition.edition_display_name}
                    </Link>
                  </TableCell>
                  {columns.includes('artwork') && (
                    <TableCell>
                      {edition.prints?.name || '-'}
                    </TableCell>
                  )}
                  {columns.includes('dateSold') && (
                    <TableCell>{formatDate(edition.date_sold)}</TableCell>
                  )}
                  {columns.includes('price') && (
                    <TableCell className="text-right">
                      {formatPrice(edition.retail_price)}
                    </TableCell>
                  )}
                  {columns.includes('netDue') && (
                    <TableCell className="text-right font-medium text-green-600">
                      {formatPrice(netDue)}
                    </TableCell>
                  )}
                  {columns.includes('actions') && (
                    <TableCell>
                      <EditionRowActions
                        edition={edition}
                        distributors={distributors}
                        sizes={sizes}
                        onMarkSold={markSold}
                        onMarkSettled={markSettled}
                        onChangeSize={updateSize}
                        onMoveToGallery={moveToGallery}
                        onMarkPrinted={markPrinted}
                        isSaving={isSaving}
                      />
                    </TableCell>
                  )}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    )
  }

  // Render the main table
  const renderTable = () => {
    // Use custom table for unsettled view
    if (isUnsettledView) {
      return renderUnsettledTable()
    }

    // Use standard EditionsDataTable
    if (finalEditions.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {hasActiveFilters ? 'No editions match your filters' : 'No editions found'}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )
    }

    return (
      <EditionsDataTable
        editions={finalEditions}
        distributors={distributors}
        sizes={sizes}
        showSelection={showSelection}
        showPagination={showPagination}
        showExpandableRows={showExpandableRows}
        enableInlineEdit={enableInlineEdit}
        pageSize={pageSize}
        columns={tableColumns}
        onUpdate={update}
        onBulkUpdate={updateMany}
        onMarkSold={markSold}
        onMarkSettled={markSettled}
        onMoveToGallery={moveToGallery}
        onMarkPrinted={markPrinted}
        isSaving={isSaving}
      />
    )
  }

  // With card wrapper
  if (showCard && (title || description || headerActions)) {
    return (
      <div className="space-y-4">
        {showFilters.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>{renderFilters()}</CardContent>
          </Card>
        )}

        {renderResultsSummary()}

        <Card>
          {(title || description || headerActions) && (
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  {title && <CardTitle>{title}</CardTitle>}
                  {description && <CardDescription>{description}</CardDescription>}
                </div>
                {headerActions}
              </div>
            </CardHeader>
          )}
          <CardContent className={title || description || headerActions ? '' : 'pt-6'}>
            <div style={maxHeight ? { maxHeight, overflow: 'auto' } : undefined}>
              {renderTable()}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Without card wrapper (bare table with optional filters)
  return (
    <div className="space-y-4">
      {showFilters.length > 0 && renderFilters()}
      {showSortControl && !showFilters.length && (
        <div className="flex justify-end">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {renderResultsSummary()}
      <div style={maxHeight ? { maxHeight, overflow: 'auto' } : undefined}>
        {renderTable()}
      </div>
    </div>
  )
}
