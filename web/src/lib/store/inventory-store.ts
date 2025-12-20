import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { createClient } from '@/lib/supabase/client'
import type { Edition, Print, Distributor, EditionWithRelations } from '@/lib/types'

interface InventoryStore {
  // Data (arrays - .find() is fast enough for 8K)
  editions: EditionWithRelations[]
  prints: Print[]
  distributors: Distributor[]

  // Status
  isLoading: boolean
  isReady: boolean
  isSaving: boolean
  error: string | null
  loadTimeMs: number | null

  // Actions
  initialize: () => Promise<void>
  updateEdition: (id: number, updates: Partial<Edition>) => Promise<boolean>
  updateEditions: (ids: number[], updates: Partial<Edition>) => Promise<boolean>
}

export const useInventoryStore = create<InventoryStore>()(
  devtools((set, get) => ({
    editions: [],
    prints: [],
    distributors: [],
    isLoading: false,
    isReady: false,
    isSaving: false,
    error: null,
    loadTimeMs: null,

    initialize: async () => {
      if (get().isReady || get().isLoading) return

      const start = performance.now()
      set({ isLoading: true, error: null })
      const supabase = createClient()

      try {
        // Fetch all records - Supabase defaults to 1000 row limit
        // editions table has ~8K rows, so we need to set explicit range
        const [editionsRes, printsRes, distributorsRes] = await Promise.all([
          supabase.from('editions').select('*').order('id').range(0, 9999),
          supabase.from('prints').select('*').order('name'),
          supabase.from('distributors').select('*').order('name'),
        ])

        if (editionsRes.error) throw editionsRes.error
        if (printsRes.error) throw printsRes.error
        if (distributorsRes.error) throw distributorsRes.error

        const prints = printsRes.data
        const distributors = distributorsRes.data

        // Join relations client-side
        const editions = editionsRes.data.map(e => ({
          ...e,
          prints: prints.find(p => p.id === e.print_id) || null,
          distributors: distributors.find(d => d.id === e.distributor_id) || null,
        }))

        const loadTimeMs = Math.round(performance.now() - start)
        console.log(`Loaded ${editions.length} editions in ${loadTimeMs}ms`)

        set({ editions, prints, distributors, isLoading: false, isReady: true, loadTimeMs })
      } catch (err) {
        set({ isLoading: false, error: err instanceof Error ? err.message : 'Load failed' })
      }
    },

    updateEdition: async (id, updates) => {
      const { editions, prints, distributors } = get()
      const index = editions.findIndex(e => e.id === id)
      if (index === -1) return false

      const previous = editions[index]

      // Optimistic update - rebuild relations if distributor_id changed
      const newEditions = [...editions]
      const updatedEdition = { ...previous, ...updates, updated_at: new Date().toISOString() }

      // Update relations if foreign keys changed
      if (updates.print_id !== undefined) {
        updatedEdition.prints = prints.find(p => p.id === updates.print_id) || null
      }
      if (updates.distributor_id !== undefined) {
        updatedEdition.distributors = distributors.find(d => d.id === updates.distributor_id) || null
      }

      newEditions[index] = updatedEdition
      set({ editions: newEditions, isSaving: true })

      // Sync to server
      const supabase = createClient()
      const { error } = await supabase
        .from('editions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        // Rollback
        const rollback = [...get().editions]
        rollback[index] = previous
        set({ editions: rollback, isSaving: false })
        return false
      }

      set({ isSaving: false })
      return true
    },

    updateEditions: async (ids, updates) => {
      const { editions, prints, distributors } = get()
      const targets = ids.map(id => ({
        index: editions.findIndex(e => e.id === id),
        previous: editions.find(e => e.id === id)
      })).filter(t => t.index !== -1 && t.previous)

      if (targets.length === 0) return false

      // Optimistic update
      const newEditions = [...editions]
      targets.forEach(({ index, previous }) => {
        const updatedEdition = { ...previous!, ...updates, updated_at: new Date().toISOString() }

        // Update relations if foreign keys changed
        if (updates.print_id !== undefined) {
          updatedEdition.prints = prints.find(p => p.id === updates.print_id) || null
        }
        if (updates.distributor_id !== undefined) {
          updatedEdition.distributors = distributors.find(d => d.id === updates.distributor_id) || null
        }

        newEditions[index] = updatedEdition
      })
      set({ editions: newEditions, isSaving: true })

      // Sync to server
      const supabase = createClient()
      const { error } = await supabase
        .from('editions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .in('id', ids)

      if (error) {
        // Rollback
        const rollback = [...get().editions]
        targets.forEach(({ index, previous }) => {
          rollback[index] = previous!
        })
        set({ editions: rollback, isSaving: false })
        return false
      }

      set({ isSaving: false })
      return true
    },
  }), { name: 'inventory' })
)
