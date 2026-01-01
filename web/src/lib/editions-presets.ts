/**
 * Preset configurations for the EditionsTableWithFilters component.
 * These define common table configurations used throughout the app.
 */

import type { EditionWithRelations } from '@/lib/types'

export type ColumnKey =
  | 'edition'
  | 'artwork'
  | 'size'
  | 'frame'
  | 'location'
  | 'price'
  | 'printed'
  | 'sale'
  | 'actions'
  | 'dateSold'
  | 'dateInGallery'
  | 'netDue'

export type FilterKey =
  | 'search'
  | 'artwork'
  | 'location'
  | 'size'
  | 'frame'
  | 'printed'
  | 'sold'

export type SortOption =
  | 'name'
  | 'artwork'
  | 'price-high'
  | 'price-low'
  | 'size'
  | 'date-sold'

export type PreFilter = {
  distributorId?: number
  printId?: number
  isPrinted?: boolean
  isSold?: boolean
  isSettled?: boolean
  /** Shorthand for isPrinted && !isSold */
  inStock?: boolean
  /** Shorthand for isSold && !isSettled */
  unsettled?: boolean
}

export type EditionsTablePreset = {
  /** Pre-applied filters (not user-changeable) */
  preFilter?: PreFilter
  /** Which columns to display */
  columns?: ColumnKey[]
  /** Which user-facing filters to show */
  showFilters?: FilterKey[]
  /** Feature toggles */
  showSelection?: boolean
  showPagination?: boolean
  showExpandableRows?: boolean
  enableInlineEdit?: boolean
  pageSize?: number
  /** Sorting configuration */
  defaultSort?: SortOption
  showSortControl?: boolean
  /** Limit rows (for preview modes) */
  maxRows?: number
}

const ALL_COLUMNS: ColumnKey[] = [
  'edition', 'artwork', 'size', 'frame', 'location', 'price', 'printed', 'sale', 'actions'
]

const ALL_FILTERS: FilterKey[] = [
  'search', 'artwork', 'location', 'size', 'frame', 'printed', 'sold'
]

/**
 * Full inventory management - all features enabled
 */
export const fullInventoryPreset: EditionsTablePreset = {
  columns: ALL_COLUMNS,
  showFilters: ALL_FILTERS,
  showSelection: true,
  showPagination: true,
  showExpandableRows: true,
  enableInlineEdit: true,
  pageSize: 50,
}

/**
 * Gallery stock view - in-stock editions at a specific gallery
 */
export function galleryStockPreset(distributorId: number): EditionsTablePreset {
  return {
    preFilter: { distributorId, inStock: true },
    columns: ['edition', 'artwork', 'size', 'frame', 'price', 'printed', 'sale', 'actions'],
    showFilters: ['search', 'size', 'frame'],
    showSelection: true,
    showPagination: true,
    showExpandableRows: true,
    enableInlineEdit: true,
    showSortControl: true,
    defaultSort: 'name',
    pageSize: 25,
  }
}

/**
 * Gallery unsettled sales - sold but unpaid editions at a specific gallery
 * Uses standard editions table for flexible editing
 */
export function galleryUnsettledPreset(distributorId: number): EditionsTablePreset {
  return {
    preFilter: { distributorId, unsettled: true },
    columns: ['edition', 'artwork', 'price', 'sale', 'actions'],
    showSelection: true,
    showPagination: false,
    showExpandableRows: true,
    enableInlineEdit: true,
  }
}

/**
 * Gallery stock preview - limited view for gallery detail page
 */
export function galleryPreviewPreset(distributorId: number): EditionsTablePreset {
  return {
    preFilter: { distributorId, inStock: true },
    columns: ['edition', 'artwork', 'size', 'frame', 'price', 'printed', 'sale'],
    showSelection: false,
    showPagination: false,
    showExpandableRows: true,
    enableInlineEdit: true,
  }
}

/**
 * Artwork editions - all editions for a specific print
 */
export function artworkEditionsPreset(printId: number): EditionsTablePreset {
  return {
    preFilter: { printId },
    columns: ['edition', 'size', 'frame', 'location', 'price', 'printed', 'sale', 'actions'],
    showFilters: ['location', 'size', 'printed', 'sold'],
    showSelection: true,
    showPagination: true,
    showExpandableRows: true,
    enableInlineEdit: true,
    pageSize: 25,
  }
}

/**
 * Apply pre-filter to editions array
 */
export function applyPreFilter(
  editions: EditionWithRelations[],
  preFilter?: PreFilter
): EditionWithRelations[] {
  if (!preFilter) return editions

  return editions.filter((e) => {
    // Check distributorId
    if (preFilter.distributorId !== undefined && e.distributor_id !== preFilter.distributorId) {
      return false
    }
    // Check printId
    if (preFilter.printId !== undefined && e.print_id !== preFilter.printId) {
      return false
    }
    // Check isPrinted
    if (preFilter.isPrinted !== undefined && e.is_printed !== preFilter.isPrinted) {
      return false
    }
    // Check isSold
    if (preFilter.isSold !== undefined && e.is_sold !== preFilter.isSold) {
      return false
    }
    // Check isSettled
    if (preFilter.isSettled !== undefined && e.is_settled !== preFilter.isSettled) {
      return false
    }
    // Check inStock (isPrinted && !isSold)
    if (preFilter.inStock && !(e.is_printed && !e.is_sold)) {
      return false
    }
    // Check unsettled (isSold && !isSettled)
    if (preFilter.unsettled && !(e.is_sold && !e.is_settled)) {
      return false
    }
    return true
  })
}

/**
 * Sort editions by the specified option
 */
export function sortEditions(
  editions: EditionWithRelations[],
  sortBy: SortOption
): EditionWithRelations[] {
  const sorted = [...editions]

  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.edition_display_name.localeCompare(b.edition_display_name)
      case 'artwork':
        return (a.prints?.name || '').localeCompare(b.prints?.name || '')
      case 'price-high':
        return (b.retail_price || 0) - (a.retail_price || 0)
      case 'price-low':
        return (a.retail_price || 0) - (b.retail_price || 0)
      case 'size':
        return (a.size || '').localeCompare(b.size || '')
      case 'date-sold':
        if (!a.date_sold && !b.date_sold) return 0
        if (!a.date_sold) return 1
        if (!b.date_sold) return -1
        return new Date(b.date_sold).getTime() - new Date(a.date_sold).getTime()
      default:
        return 0
    }
  })

  return sorted
}
