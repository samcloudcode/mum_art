import { useMemo, useCallback } from 'react'
import { useInventoryStore } from '@/lib/store/inventory-store'
import type { EditionFilters } from '@/lib/types'
import { useShallow } from 'zustand/react/shallow'

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
  // Use shallow comparison to prevent unnecessary re-renders
  // This only re-renders when the selected values actually change
  const {
    editions: allEditions,
    prints,
    distributors,
    _searchIndex,
    isLoading,
    isReady,
    isSaving,
    savingIds,
    loadTimeMs,
    error,
    initialize,
    updateEdition,
    updateEditions,
    toggleDistributorFavorite,
    isEditionSaving,
  } = useInventoryStore(
    useShallow((state) => ({
      editions: state.editions,
      prints: state.prints,
      distributors: state.distributors,
      _searchIndex: state._searchIndex,
      isLoading: state.isLoading,
      isReady: state.isReady,
      isSaving: state.isSaving,
      savingIds: state.savingIds,
      loadTimeMs: state.loadTimeMs,
      error: state.error,
      initialize: state.initialize,
      updateEdition: state.updateEdition,
      updateEditions: state.updateEditions,
      toggleDistributorFavorite: state.toggleDistributorFavorite,
      isEditionSaving: state.isEditionSaving,
    }))
  )

  // Stage 1: Apply search filter using pre-computed search index
  const searchFiltered = useMemo(() => {
    if (!filters.search) return allEditions

    const searchLower = filters.search.toLowerCase()
    const smartSearch = parseSmartSearch(filters.search)

    return allEditions.filter((e) => {
      // Use pre-computed lowercase strings from search index
      const cached = _searchIndex.get(e.id)
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
  }, [allEditions, _searchIndex, filters.search])

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
    const unique = new Set(allEditions.map((e) => e.size).filter(Boolean) as string[])
    return Array.from(unique).sort()
  }, [allEditions])

  const frameTypes = useMemo(() => {
    const unique = new Set(allEditions.map((e) => e.frame_type).filter(Boolean) as string[])
    return Array.from(unique).sort()
  }, [allEditions])

  // Memoize all callback functions to maintain stable references
  // This is critical for preventing unnecessary re-renders of memoized child components
  const markPrinted = useCallback(
    (ids: number[]) => updateEditions(ids, { is_printed: true }),
    [updateEditions]
  )

  const markNotPrinted = useCallback(
    (ids: number[]) => updateEditions(ids, { is_printed: false }),
    [updateEditions]
  )

  const markSold = useCallback(
    (id: number, price: number, date: string, commissionPercentage?: number) =>
      updateEdition(id, {
        is_sold: true,
        retail_price: price,
        date_sold: date,
        commission_percentage: commissionPercentage,
      }),
    [updateEdition]
  )

  const moveToGallery = useCallback(
    (ids: number[], distributorId: number, dateInGallery?: string) =>
      updateEditions(ids, {
        distributor_id: distributorId,
        date_in_gallery: dateInGallery || new Date().toISOString().split('T')[0],
      }),
    [updateEditions]
  )

  const markSettled = useCallback(
    (ids: number[], paymentNote?: string) =>
      updateEditions(ids, { is_settled: true, payment_note: paymentNote || null }),
    [updateEditions]
  )

  const updateSize = useCallback(
    (ids: number[], size: string) => updateEditions(ids, { size }),
    [updateEditions]
  )

  const refresh = useCallback(() => initialize(), [initialize])

  return {
    // Data
    editions: filtered,
    allEditions,
    prints,
    distributors,
    sizes,
    frameTypes,

    // Status
    isLoading,
    isReady,
    isSaving,
    savingIds, // Set of edition IDs currently being saved - for per-row saving state
    isEditionSaving, // Function to check if a specific edition is saving
    loadTimeMs,
    error,

    // Mutations - these are already stable from the store
    update: updateEdition,
    updateMany: updateEditions,

    // Force refresh
    refresh,

    // Convenience wrappers - memoized for stable references
    markPrinted,
    markNotPrinted,
    markSold,
    moveToGallery,
    markSettled,
    updateSize,

    // Distributor actions
    toggleDistributorFavorite,
  }
}
