'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useInventory } from '@/lib/hooks/use-inventory'
import { EditionsDataTable } from './editions-data-table'
import { MobileEditionCard } from './mobile-edition-card'
import {
  type EditionsTablePreset,
  type ColumnKey,
  type FilterKey,
  type SortOption,
  applyPreFilter,
  sortEditions,
} from '@/lib/editions-presets'
import { formatPrice, cn } from '@/lib/utils'
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
import { Search, X, Loader2, LayoutGrid, Table2, SlidersHorizontal, ChevronDown } from 'lucide-react'

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

type ViewMode = 'table' | 'cards'

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
  /** Enable mobile card view with toggle */
  enableMobileView?: boolean
  /** Hide location in mobile cards (useful when already filtered by gallery) */
  hideLocationInCards?: boolean
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
  enableMobileView = false,
  hideLocationInCards = false,
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

  // View mode state (auto-detect mobile on mount)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [isMobile, setIsMobile] = useState(false)
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  // Detect mobile on mount and when window resizes
  useEffect(() => {
    if (!enableMobileView) return

    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      // Auto-switch to cards on mobile, but respect user choice
      if (mobile && viewMode === 'table') {
        setViewMode('cards')
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [enableMobileView]) // Only run on mount, don't include viewMode to respect user choice

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

  // View toggle component
  const renderViewToggle = () => {
    if (!enableMobileView) return null

    return (
      <div className="flex items-center gap-1 border border-border rounded-lg p-1">
        <button
          onClick={() => setViewMode('cards')}
          className={cn(
            'p-2 rounded transition-colors',
            viewMode === 'cards'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title="Card view"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={cn(
            'p-2 rounded transition-colors',
            viewMode === 'table'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title="Table view"
        >
          <Table2 className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (debouncedSearch) count++
    if (artworkFilter !== 'all') count++
    if (locationFilter !== 'all') count++
    if (sizeFilter !== 'all') count++
    if (frameFilter !== 'all') count++
    if (printedFilter !== 'all') count++
    if (soldFilter !== 'all') count++
    return count
  }, [debouncedSearch, artworkFilter, locationFilter, sizeFilter, frameFilter, printedFilter, soldFilter])

  // Render filters
  const renderFilters = () => {
    if (showFilters.length === 0 && !showSortControl && !enableMobileView) return null

    const hasQuickToggles = showFilters.includes('printed') || showFilters.includes('sold')
    const hasDropdowns = showFilters.some((f) => !['printed', 'sold'].includes(f)) || showSortControl
    const hasMultipleFilters = showFilters.length > 2

    // Mobile collapsible filter header
    const renderMobileFilterHeader = () => {
      if (!isMobile || !hasMultipleFilters) return null

      return (
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="w-full flex items-center justify-between p-3 bg-secondary/50 rounded-lg md:hidden"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              filtersExpanded && 'rotate-180'
            )}
          />
        </button>
      )
    }

    return (
      <div className="space-y-4">
        {/* Mobile filter toggle */}
        {renderMobileFilterHeader()}

        {/* Quick toggle filters - always visible */}
        {hasQuickToggles && (
          <div className={cn(
            'flex flex-wrap items-center justify-between gap-4',
            isMobile && hasMultipleFilters && !filtersExpanded && 'hidden md:flex'
          )}>
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
            {renderViewToggle()}
          </div>
        )}

        {/* Dropdown filters and search */}
        {hasDropdowns && (
          <div className={cn(
            'flex flex-wrap gap-4',
            isMobile && hasMultipleFilters && !filtersExpanded && 'hidden md:flex'
          )}>
            {/* Search */}
            {showFilters.includes('search') && (
              <div className="relative flex-1 min-w-[200px] w-full md:w-auto">
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
                <SelectTrigger className="w-full md:w-[180px]">
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
                <SelectTrigger className="w-full md:w-[180px]">
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
                <SelectTrigger className="w-full md:w-[150px]">
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
                <SelectTrigger className="w-full md:w-[150px]">
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
                <SelectTrigger className="w-full md:w-[180px]">
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

            {/* View toggle (if no quick toggles) */}
            {!hasQuickToggles && renderViewToggle()}
          </div>
        )}

        {/* View toggle only (no filters but mobile view enabled) */}
        {!hasQuickToggles && !hasDropdowns && enableMobileView && (
          <div className="flex justify-end">
            {renderViewToggle()}
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

  // Render mobile card view
  const renderMobileCards = () => {
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

    // Apply pagination for mobile cards too
    const startIndex = showPagination ? (page - 1) * pageSize : 0
    const endIndex = showPagination ? startIndex + pageSize : finalEditions.length
    const paginatedEditions = finalEditions.slice(startIndex, endIndex)
    const totalPages = Math.ceil(finalEditions.length / pageSize)

    return (
      <div className="space-y-3">
        {paginatedEditions.map((edition) => (
          <MobileEditionCard
            key={edition.id}
            edition={edition}
            showLocation={!hideLocationInCards}
          />
        ))}

        {/* Pagination for mobile cards */}
        {showPagination && finalEditions.length > pageSize && (
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              {startIndex + 1}–{Math.min(endIndex, finalEditions.length)} of {finalEditions.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Pagination state for mobile cards
  const [page, setPage] = useState(1)

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, artworkFilter, locationFilter, sizeFilter, frameFilter, printedFilter, soldFilter])

  // Render the main table
  const renderTable = () => {
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
        columns={columns}
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

  // Render content based on view mode
  const renderContent = () => {
    if (enableMobileView && viewMode === 'cards') {
      return renderMobileCards()
    }
    return renderTable()
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
              {renderContent()}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Without card wrapper (bare table with optional filters)
  return (
    <div className="space-y-4">
      {(showFilters.length > 0 || enableMobileView) && renderFilters()}
      {showSortControl && !showFilters.length && !enableMobileView && (
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
        {renderContent()}
      </div>
    </div>
  )
}
