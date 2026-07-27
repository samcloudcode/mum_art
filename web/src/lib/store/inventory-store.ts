import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { createClient } from '@/lib/supabase/client'
import type { Edition, Print, Distributor, EditionWithRelations } from '@/lib/types'

// Helper to log activity
async function logActivity(params: {
  action: string
  entityType: string
  entityId: number
  entityName: string
  fieldName?: string
  oldValue?: string | null
  newValue?: string | null
  description?: string
  relatedEntityType?: string
  relatedEntityId?: number
  relatedEntityName?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  await supabase.from('activity_log').insert({
    user_id: user?.id,
    user_email: user?.email,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    entity_name: params.entityName,
    field_name: params.fieldName,
    old_value: params.oldValue,
    new_value: params.newValue,
    description: params.description,
    related_entity_type: params.relatedEntityType,
    related_entity_id: params.relatedEntityId,
    related_entity_name: params.relatedEntityName,
  })
}

// A single field's before/after, destined for one activity_log row.
type FieldChange = { fieldName: string; oldValue: string; newValue: string }

// Every field this update actually alters, one entry each.
//
// activity_log has flat field_name/old_value/new_value columns, so a row can
// only ever describe ONE field. Callers therefore write one row per entry here
// rather than one row per update — see the comment at the updateEdition call
// site for why that matters.
//
// Fields whose value is unchanged are skipped, so a row in the log means that
// field genuinely moved. Comparison is on the stringified value, which is what
// gets stored, so null/undefined/'' do not produce phantom changes.
function fieldChanges(
  previous: EditionWithRelations,
  updates: Partial<Edition>,
  distributorMap: Map<number, Distributor>
): FieldChange[] {
  const changes: FieldChange[] = []

  for (const key of Object.keys(updates)) {
    if (key === 'updated_at') continue

    let fieldName = key
    let oldValue: string
    let newValue: string

    if (key === 'distributor_id') {
      // Log moves as a readable location rather than raw ids. Distributor names
      // are unique, so this stays losslessly recoverable, and it matches how
      // every move has been logged since 003_add_activity_log.
      const newDist = updates.distributor_id ? distributorMap.get(updates.distributor_id) : null
      fieldName = 'location'
      oldValue = previous.distributors?.name || 'unassigned'
      newValue = newDist?.name || 'unassigned'
    } else {
      oldValue = String(previous[key as keyof typeof previous] ?? '')
      newValue = String(updates[key as keyof typeof updates] ?? '')
    }

    if (oldValue === newValue) continue
    changes.push({ fieldName, oldValue, newValue })
  }

  return changes
}

// Generate human-readable description of changes, plus the per-field detail
// needed to reconstruct them.
function describeChanges(
  previous: EditionWithRelations,
  updates: Partial<Edition>,
  distributorMap: Map<number, Distributor>
): { action: string; description: string; changes: FieldChange[]; relatedEntityType?: string; relatedEntityId?: number; relatedEntityName?: string } {
  // Every branch below carries the same `changes`. The semantic ones used to
  // return a description alone, which is why "Marked as sold" recorded nothing
  // about the date_sold it set — and why a mistyped sale date had no old_value
  // to revert to.
  const changes = fieldChanges(previous, updates, distributorMap)

  // Check for specific meaningful changes
  if (updates.is_sold === true && !previous.is_sold) {
    return { action: 'sell', description: 'Marked as sold', changes }
  }
  if (updates.is_sold === false && previous.is_sold) {
    return { action: 'update', description: 'Unmarked as sold', changes }
  }
  if (updates.is_settled === true && !previous.is_settled) {
    return { action: 'settle', description: 'Marked as settled', changes }
  }
  if (updates.is_settled === false && previous.is_settled) {
    return { action: 'update', description: 'Unmarked as settled', changes }
  }
  if (updates.distributor_id !== undefined && updates.distributor_id !== previous.distributor_id) {
    const newDist = updates.distributor_id ? distributorMap.get(updates.distributor_id) : null
    const oldDist = previous.distributors
    return {
      action: 'move',
      description: `Moved from ${oldDist?.name || 'unassigned'} to ${newDist?.name || 'unassigned'}`,
      changes,
      relatedEntityType: 'distributor',
      relatedEntityId: updates.distributor_id || undefined,
      relatedEntityName: newDist?.name,
    }
  }
  if (updates.is_printed === true && !previous.is_printed) {
    return { action: 'update', description: 'Marked as printed', changes }
  }

  // Generic field updates
  if (changes.length === 1) {
    return { action: 'update', description: `Updated ${changes[0].fieldName}`, changes }
  }

  return { action: 'update', description: `Updated ${changes.length} fields`, changes }
}

type Favoritable = { id: number; name: string; is_favorite?: boolean | null }

/**
 * Favourites first, then alphabetical.
 *
 * Applied where the data enters the store so every consumer inherits the order.
 * The dropdowns each build their own option list from these arrays and none of
 * them sort, so ordering here is what puts favourites on top everywhere.
 */
function favoritesFirst<T extends Favoritable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!!a.is_favorite !== !!b.is_favorite) return a.is_favorite ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Optimistic favourite flip, shared by the print and distributor toggles.
 * Returns the re-sorted list and an updated lookup map, or null if id is absent.
 */
function applyFavorite<T extends Favoritable>(
  items: T[],
  map: Map<number, T>,
  id: number,
  isFavorite: boolean
): { items: T[]; map: Map<number, T> } | null {
  const index = items.findIndex((item) => item.id === id)
  if (index === -1) return null

  const updated = { ...items[index], is_favorite: isFavorite, updated_at: new Date().toISOString() }
  const nextItems = [...items]
  nextItems[index] = updated

  const nextMap = new Map(map)
  nextMap.set(id, updated)

  return { items: favoritesFirst(nextItems), map: nextMap }
}

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

  // Derived data (stable references - computed once on load)
  sizes: string[]
  frameTypes: string[]

  // Lookup maps (derived, not persisted)
  _printMap: PrintMap
  _distributorMap: DistributorMap
  _editionIndexMap: EditionIndexMap
  _searchIndex: SearchIndex

  // Status
  isLoading: boolean
  isReady: boolean
  isSaving: boolean // Global saving indicator (true when any save is in progress)
  savingIds: Set<number> // Track which specific edition IDs are currently saving
  error: string | null
  loadTimeMs: number | null

  // Actions
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  updateEdition: (id: number, updates: Partial<Edition>) => Promise<boolean>
  updateEditions: (ids: number[], updates: Partial<Edition>) => Promise<boolean>
  toggleDistributorFavorite: (id: number) => Promise<boolean>
  togglePrintFavorite: (id: number) => Promise<boolean>
  isEditionSaving: (id: number) => boolean
}

export const useInventoryStore = create<InventoryStore>()(
  devtools(
    (set, get) => ({
        editions: [],
        prints: [],
        distributors: [],
        sizes: [],
        frameTypes: [],
        _printMap: new Map(),
        _distributorMap: new Map(),
        _editionIndexMap: new Map(),
        _searchIndex: new Map(),
        isLoading: false,
        isReady: false,
        isSaving: false,
        savingIds: new Set(),
        error: null,
        loadTimeMs: null,

        isEditionSaving: (id: number) => get().savingIds.has(id),

        refresh: async () => {
          // Reset state and force re-initialization
          set({ isReady: false, isLoading: false })
          await get().initialize()
        },

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

            // Server orders by name; re-sort so favourites lead. Every dropdown
            // renders these arrays as-is, so this is the single place that
            // decides dropdown order.
            const prints = favoritesFirst(printsRes.data)
            const distributors = favoritesFirst(distributorsRes.data)

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

            // Derive unique sizes and frame types (stable arrays - won't change on edition updates)
            const sizesSet = new Set<string>()
            const frameTypesSet = new Set<string>()
            for (const e of editions) {
              if (e.size) sizesSet.add(e.size)
              if (e.frame_type) frameTypesSet.add(e.frame_type)
            }
            const sizes = Array.from(sizesSet).sort()
            const frameTypes = Array.from(frameTypesSet).sort()

            const loadTimeMs = Math.round(performance.now() - start)
            console.log(`Loaded ${editions.length} editions in ${loadTimeMs}ms`)

            set({
              editions,
              prints,
              distributors,
              sizes,
              frameTypes,
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

          // Track this specific edition as saving
          const newSavingIds = new Set(state.savingIds)
          newSavingIds.add(id)

          set({
            editions: newEditions,
            _searchIndex: newSearchIndex,
            isSaving: true,
            savingIds: newSavingIds,
          })

          // Sync to server
          const supabase = createClient()
          const { error } = await supabase
            .from('editions')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)

          // Remove from saving IDs
          const currentState = get()
          const updatedSavingIds = new Set(currentState.savingIds)
          updatedSavingIds.delete(id)
          const stillSaving = updatedSavingIds.size > 0

          if (error) {
            // Rollback
            const rollback = [...currentState.editions]
            rollback[index] = previous
            set({ editions: rollback, isSaving: stillSaving, savingIds: updatedSavingIds })
            return false
          }

          // Log activity (fire and forget - don't block on this).
          //
          // One row per changed field. A single row cannot describe a
          // multi-field update: field_name/old_value/new_value are flat
          // columns, so such a row records that something changed but not
          // what. That is what made the 2026-07-26 Kendalls stock-check reset
          // unrecoverable by inspection — it cleared two fields at once and
          // logged 51 rows of nulls. See scripts/db/01_diagnose_kendalls_reset.sql.
          const changeInfo = describeChanges(previous, updates, state._distributorMap)
          for (const change of changeInfo.changes) {
            logActivity({
              action: changeInfo.action,
              entityType: 'edition',
              entityId: id,
              entityName: previous.edition_display_name,
              fieldName: change.fieldName,
              oldValue: change.oldValue,
              newValue: change.newValue,
              description: changeInfo.description,
              relatedEntityType: changeInfo.relatedEntityType,
              relatedEntityId: changeInfo.relatedEntityId,
              relatedEntityName: changeInfo.relatedEntityName,
            }).catch(console.error)
          }

          set({ isSaving: stillSaving, savingIds: updatedSavingIds })
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

          // Track these specific editions as saving
          const newSavingIds = new Set(state.savingIds)
          for (const id of ids) {
            newSavingIds.add(id)
          }

          set({
            editions: newEditions,
            _searchIndex: newSearchIndex,
            isSaving: true,
            savingIds: newSavingIds,
          })

          // Sync to server
          const supabase = createClient()
          const { error } = await supabase
            .from('editions')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .in('id', ids)

          // Remove from saving IDs
          const currentState = get()
          const updatedSavingIds = new Set(currentState.savingIds)
          for (const id of ids) {
            updatedSavingIds.delete(id)
          }
          const stillSaving = updatedSavingIds.size > 0

          if (error) {
            // Rollback
            const rollback = [...currentState.editions]
            for (const { index, previous } of targets) {
              rollback[index] = previous
            }
            set({ editions: rollback, isSaving: stillSaving, savingIds: updatedSavingIds })
            return false
          }

          // Log activity for each edition, one row per changed field (fire and
          // forget). `updates` is shared across the batch but `previous` is
          // not, so each edition logs only the fields that moved for it — a
          // gallery reset no longer writes rows for editions that were already
          // clear.
          for (const { previous } of targets) {
            const changeInfo = describeChanges(previous, updates, state._distributorMap)
            for (const change of changeInfo.changes) {
              logActivity({
                action: changeInfo.action,
                entityType: 'edition',
                entityId: previous.id,
                entityName: previous.edition_display_name,
                fieldName: change.fieldName,
                oldValue: change.oldValue,
                newValue: change.newValue,
                description: `${changeInfo.description} (bulk update of ${targets.length} editions)`,
                relatedEntityType: changeInfo.relatedEntityType,
                relatedEntityId: changeInfo.relatedEntityId,
                relatedEntityName: changeInfo.relatedEntityName,
              }).catch(console.error)
            }
          }

          set({ isSaving: stillSaving, savingIds: updatedSavingIds })
          return true
        },

        toggleDistributorFavorite: async (id) => {
          const state = get()
          const previous = state._distributorMap.get(id)
          if (!previous) return false

          const newIsFavorite = !previous.is_favorite
          const next = applyFavorite(state.distributors, state._distributorMap, id, newIsFavorite)
          if (!next) return false

          set({ distributors: next.items, _distributorMap: next.map, isSaving: true })

          const supabase = createClient()
          const { error } = await supabase
            .from('distributors')
            .update({ is_favorite: newIsFavorite, updated_at: new Date().toISOString() })
            .eq('id', id)

          if (error) {
            const rolled = applyFavorite(
              get().distributors, get()._distributorMap, id, !!previous.is_favorite
            )
            set({
              distributors: rolled ? rolled.items : get().distributors,
              _distributorMap: rolled ? rolled.map : get()._distributorMap,
              isSaving: false,
            })
            return false
          }

          logActivity({
            action: 'update',
            entityType: 'distributor',
            entityId: id,
            entityName: previous.name,
            fieldName: 'is_favorite',
            oldValue: String(previous.is_favorite),
            newValue: String(newIsFavorite),
            description: newIsFavorite ? 'Added to favorites' : 'Removed from favorites',
          }).catch(console.error)

          set({ isSaving: false })
          return true
        },

        togglePrintFavorite: async (id) => {
          const state = get()
          const previous = state._printMap.get(id)
          if (!previous) return false

          const newIsFavorite = !previous.is_favorite
          const next = applyFavorite(state.prints, state._printMap, id, newIsFavorite)
          if (!next) return false

          set({ prints: next.items, _printMap: next.map, isSaving: true })

          const supabase = createClient()
          const { error } = await supabase
            .from('prints')
            .update({ is_favorite: newIsFavorite, updated_at: new Date().toISOString() })
            .eq('id', id)

          if (error) {
            const rolled = applyFavorite(
              get().prints, get()._printMap, id, !!previous.is_favorite
            )
            set({
              prints: rolled ? rolled.items : get().prints,
              _printMap: rolled ? rolled.map : get()._printMap,
              isSaving: false,
            })
            return false
          }

          logActivity({
            action: 'update',
            entityType: 'print',
            entityId: id,
            entityName: previous.name,
            fieldName: 'is_favorite',
            oldValue: String(previous.is_favorite),
            newValue: String(newIsFavorite),
            description: newIsFavorite ? 'Added to favorites' : 'Removed from favorites',
          }).catch(console.error)

          set({ isSaving: false })
          return true
        },
      }),
    { name: 'inventory' }
  )
)
