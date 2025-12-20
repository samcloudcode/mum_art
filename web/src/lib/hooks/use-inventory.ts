import { useMemo } from 'react'
import { useInventoryStore } from '@/lib/store/inventory-store'
import type { EditionFilters } from '@/lib/types'

export function useInventory(filters: EditionFilters = {}) {
  const store = useInventoryStore()

  const filtered = useMemo(() => {
    return store.editions.filter(e => {
      if (filters.search && !e.edition_display_name.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.printId && e.print_id !== filters.printId) return false
      if (filters.distributorId && e.distributor_id !== filters.distributorId) return false
      if (filters.size && e.size !== filters.size) return false
      if (filters.frameType && e.frame_type !== filters.frameType) return false
      if (filters.isPrinted !== undefined && filters.isPrinted !== null && e.is_printed !== filters.isPrinted) return false
      if (filters.isSold !== undefined && filters.isSold !== null && e.is_sold !== filters.isSold) return false
      if (filters.isSettled !== undefined && filters.isSettled !== null && e.is_settled !== filters.isSettled) return false
      return true
    })
  }, [store.editions, filters])

  return {
    // Data
    editions: filtered,
    allEditions: store.editions,
    prints: store.prints,
    distributors: store.distributors,

    // Status
    isLoading: store.isLoading,
    isReady: store.isReady,
    isSaving: store.isSaving,
    loadTimeMs: store.loadTimeMs,
    error: store.error,

    // Mutations
    update: store.updateEdition,
    updateMany: store.updateEditions,

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
        date_in_gallery: dateInGallery || new Date().toISOString().split('T')[0]
      }),
    markSettled: (ids: number[], paymentNote?: string) =>
      store.updateEditions(ids, { is_settled: true, payment_note: paymentNote || null }),
  }
}
