import { useMemo } from 'react'
import { useInventoryStore } from '@/lib/store/inventory-store'
import type { EditionFilters } from '@/lib/types'

/**
 * Parse search query for smart search patterns
 * Supports: "Bembridge 4", "Bembridge #4", "Bembridge - 4", "bembridge4"
 * Returns artwork name and edition number if pattern matches
 */
function parseSmartSearch(query: string): { artwork: string; editionNum: number } | null {
  if (!query) return null

  // Pattern: "artwork name" followed by optional separator and number
  // Matches: "Bembridge 4", "Bembridge #4", "Bembridge - 4", "Bembridge-4"
  const match = query.match(/^(.+?)[\s#-]*(\d+)$/)
  if (match) {
    return {
      artwork: match[1].trim().toLowerCase(),
      editionNum: parseInt(match[2]),
    }
  }

  return null
}

export function useInventory(filters: EditionFilters = {}) {
  const store = useInventoryStore()

  // Stage 1: Apply search filter using pre-computed search index
  const searchFiltered = useMemo(() => {
    if (!filters.search) return store.editions

    const searchLower = filters.search.toLowerCase()
    const smartSearch = parseSmartSearch(filters.search)

    return store.editions.filter((e) => {
      // Use pre-computed lowercase strings from search index
      const cached = store._searchIndex.get(e.id)
      if (!cached) return false

      // Smart search - match artwork name + edition number
      if (smartSearch) {
        if (
          e.edition_number === smartSearch.editionNum &&
          cached.artworkName.includes(smartSearch.artwork)
        ) {
          return true
        }
      }

      // Regular search on display name and artwork name
      return cached.displayName.includes(searchLower) || cached.artworkName.includes(searchLower)
    })
  }, [store.editions, store._searchIndex, filters.search])

  // Stage 2: Apply remaining filters (only recalculates when those specific filters change)
  const filtered = useMemo(() => {
    // If no other filters, return search results directly
    if (
      !filters.printId &&
      !filters.distributorId &&
      !filters.size &&
      !filters.frameType &&
      filters.isPrinted === undefined &&
      filters.isSold === undefined &&
      filters.isSettled === undefined &&
      !filters.isUnsettled
    ) {
      return searchFiltered
    }

    return searchFiltered.filter((e) => {
      if (filters.printId && e.print_id !== filters.printId) return false
      if (filters.distributorId && e.distributor_id !== filters.distributorId) return false
      if (filters.size && e.size !== filters.size) return false
      if (filters.frameType && e.frame_type !== filters.frameType) return false
      if (
        filters.isPrinted !== undefined &&
        filters.isPrinted !== null &&
        e.is_printed !== filters.isPrinted
      )
        return false
      if (filters.isSold !== undefined && filters.isSold !== null && e.is_sold !== filters.isSold)
        return false
      if (
        filters.isSettled !== undefined &&
        filters.isSettled !== null &&
        e.is_settled !== filters.isSettled
      )
        return false

      // Unsettled filter (sold but not settled)
      if (filters.isUnsettled) {
        if (!e.is_sold || e.is_settled) return false
      }

      return true
    })
  }, [
    searchFiltered,
    filters.printId,
    filters.distributorId,
    filters.size,
    filters.frameType,
    filters.isPrinted,
    filters.isSold,
    filters.isSettled,
    filters.isUnsettled,
  ])

  // Derive unique sizes and frame types from data
  const sizes = useMemo(() => {
    const unique = new Set(store.editions.map((e) => e.size).filter(Boolean) as string[])
    return Array.from(unique).sort()
  }, [store.editions])

  const frameTypes = useMemo(() => {
    const unique = new Set(store.editions.map((e) => e.frame_type).filter(Boolean) as string[])
    return Array.from(unique).sort()
  }, [store.editions])

  return {
    // Data
    editions: filtered,
    allEditions: store.editions,
    prints: store.prints,
    distributors: store.distributors,
    sizes,
    frameTypes,

    // Status
    isLoading: store.isLoading,
    isReady: store.isReady,
    isSaving: store.isSaving,
    loadTimeMs: store.loadTimeMs,
    error: store.error,

    // Mutations
    update: store.updateEdition,
    updateMany: store.updateEditions,

    // Force refresh
    refresh: () => store.initialize(),

    // Convenience wrappers
    markPrinted: (ids: number[]) => store.updateEditions(ids, { is_printed: true }),
    markNotPrinted: (ids: number[]) => store.updateEditions(ids, { is_printed: false }),
    markSold: (id: number, price: number, date: string, commissionPercentage?: number) =>
      store.updateEdition(id, {
        is_sold: true,
        retail_price: price,
        date_sold: date,
        commission_percentage: commissionPercentage,
      }),
    moveToGallery: (ids: number[], distributorId: number, dateInGallery?: string) =>
      store.updateEditions(ids, {
        distributor_id: distributorId,
        date_in_gallery: dateInGallery || new Date().toISOString().split('T')[0],
      }),
    markSettled: (ids: number[], paymentNote?: string) =>
      store.updateEditions(ids, { is_settled: true, payment_note: paymentNote || null }),
    updateSize: (ids: number[], size: string) => store.updateEditions(ids, { size }),

    // Distributor actions
    toggleDistributorFavorite: store.toggleDistributorFavorite,
  }
}
