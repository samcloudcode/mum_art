import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { createClient } from '@/lib/supabase/client'
import type { Edition, Print, Distributor, EditionWithRelations } from '@/lib/types'

// Lookup maps for O(1) access
type PrintMap = Map<number, Print>
type DistributorMap = Map<number, Distributor>
type EditionIndexMap = Map<number, number> // id -> array index
type SearchIndex = Map<number, { displayName: string; artworkName: string }>

interface InventoryStore {
  // Data
  editions: EditionWithRelations[]
  prints: Print[]
  distributors: Distributor[]

  // Lookup maps (derived, not persisted)
  _printMap: PrintMap
  _distributorMap: DistributorMap
  _editionIndexMap: EditionIndexMap
  _searchIndex: SearchIndex

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
  toggleDistributorFavorite: (id: number) => Promise<boolean>
}

export const useInventoryStore = create<InventoryStore>()(
  devtools(
    (set, get) => ({
        editions: [],
        prints: [],
        distributors: [],
        _printMap: new Map(),
        _distributorMap: new Map(),
        _editionIndexMap: new Map(),
        _searchIndex: new Map(),
        isLoading: false,
        isReady: false,
        isSaving: false,
        error: null,
        loadTimeMs: null,

        initialize: async () => {
          const state = get()

          // Skip if already loading
          if (state.isLoading) return

          const start = performance.now()
          set({ isLoading: true, error: null })
          const supabase = createClient()

          try {
            // Fetch all records in parallel
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

            // Build lookup maps first for O(1) joins
            const printMap = new Map(prints.map((p) => [p.id, p]))
            const distributorMap = new Map(distributors.map((d) => [d.id, d]))

            // Join relations using maps - O(n) instead of O(n*m)
            const editions: EditionWithRelations[] = editionsRes.data.map((e) => ({
              ...e,
              prints: printMap.get(e.print_id) || null,
              distributors: e.distributor_id ? distributorMap.get(e.distributor_id) || null : null,
            }))

            // Build remaining index maps
            const editionIndexMap = new Map(editions.map((e, i) => [e.id, i]))
            const searchIndex = new Map(
              editions.map((e) => [
                e.id,
                {
                  displayName: e.edition_display_name.toLowerCase(),
                  artworkName: e.prints?.name?.toLowerCase() || '',
                },
              ])
            )

            const loadTimeMs = Math.round(performance.now() - start)
            console.log(`Loaded ${editions.length} editions in ${loadTimeMs}ms`)

            set({
              editions,
              prints,
              distributors,
              _printMap: printMap,
              _distributorMap: distributorMap,
              _editionIndexMap: editionIndexMap,
              _searchIndex: searchIndex,
              isLoading: false,
              isReady: true,
              loadTimeMs,
            })
          } catch (err) {
            set({
              isLoading: false,
              error: err instanceof Error ? err.message : 'Load failed',
            })
          }
        },

        updateEdition: async (id, updates) => {
          const state = get()
          const index = state._editionIndexMap.get(id)
          if (index === undefined) return false

          const previous = state.editions[index]

          // Optimistic update
          const updatedEdition = {
            ...previous,
            ...updates,
            updated_at: new Date().toISOString(),
          }

          // Update relations if foreign keys changed
          if (updates.print_id !== undefined) {
            updatedEdition.prints = state._printMap.get(updates.print_id) || null
          }
          if (updates.distributor_id !== undefined) {
            updatedEdition.distributors = updates.distributor_id
              ? state._distributorMap.get(updates.distributor_id) || null
              : null
          }

          // Create new array reference for React
          const newEditions = [...state.editions]
          newEditions[index] = updatedEdition

          // Update search index
          const newSearchIndex = new Map(state._searchIndex)
          newSearchIndex.set(id, {
            displayName: updatedEdition.edition_display_name.toLowerCase(),
            artworkName: updatedEdition.prints?.name?.toLowerCase() || '',
          })

          set({
            editions: newEditions,
            _searchIndex: newSearchIndex,
            isSaving: true,
          })

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
          const state = get()
          const targets: { index: number; previous: EditionWithRelations }[] = []

          for (const id of ids) {
            const index = state._editionIndexMap.get(id)
            if (index !== undefined) {
              targets.push({ index, previous: state.editions[index] })
            }
          }

          if (targets.length === 0) return false

          // Optimistic update
          const newEditions = [...state.editions]
          const newSearchIndex = new Map(state._searchIndex)

          for (const { index, previous } of targets) {
            const updatedEdition = {
              ...previous,
              ...updates,
              updated_at: new Date().toISOString(),
            }

            // Update relations if foreign keys changed
            if (updates.print_id !== undefined) {
              updatedEdition.prints = state._printMap.get(updates.print_id) || null
            }
            if (updates.distributor_id !== undefined) {
              updatedEdition.distributors = updates.distributor_id
                ? state._distributorMap.get(updates.distributor_id) || null
                : null
            }

            newEditions[index] = updatedEdition
            newSearchIndex.set(previous.id, {
              displayName: updatedEdition.edition_display_name.toLowerCase(),
              artworkName: updatedEdition.prints?.name?.toLowerCase() || '',
            })
          }

          set({
            editions: newEditions,
            _searchIndex: newSearchIndex,
            isSaving: true,
          })

          // Sync to server
          const supabase = createClient()
          const { error } = await supabase
            .from('editions')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .in('id', ids)

          if (error) {
            // Rollback
            const rollback = [...get().editions]
            for (const { index, previous } of targets) {
              rollback[index] = previous
            }
            set({ editions: rollback, isSaving: false })
            return false
          }

          set({ isSaving: false })
          return true
        },

        toggleDistributorFavorite: async (id) => {
          const state = get()
          const index = state.distributors.findIndex((d) => d.id === id)
          if (index === -1) return false

          const previous = state.distributors[index]
          const newIsFavorite = !previous.is_favorite

          // Optimistic update
          const newDistributors = [...state.distributors]
          newDistributors[index] = {
            ...previous,
            is_favorite: newIsFavorite,
            updated_at: new Date().toISOString(),
          }

          // Update the map as well
          const newDistributorMap = new Map(state._distributorMap)
          newDistributorMap.set(id, newDistributors[index])

          set({
            distributors: newDistributors,
            _distributorMap: newDistributorMap,
            isSaving: true,
          })

          // Sync to server
          const supabase = createClient()
          const { error } = await supabase
            .from('distributors')
            .update({ is_favorite: newIsFavorite, updated_at: new Date().toISOString() })
            .eq('id', id)

          if (error) {
            // Rollback
            const rollback = [...get().distributors]
            rollback[index] = previous
            const rollbackMap = new Map(get()._distributorMap)
            rollbackMap.set(id, previous)
            set({ distributors: rollback, _distributorMap: rollbackMap, isSaving: false })
            return false
          }

          set({ isSaving: false })
          return true
        },
      }),
    { name: 'inventory' }
  )
)
