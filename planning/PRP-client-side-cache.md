# Project Requirements Plan: Client-Side Cache with Optimistic Updates

## Overview

Load all ~8K inventory records into browser memory for instant navigation, filtering, and editing.

### Goals
- **Instant filtering** - no server round-trips
- **Optimistic updates** - UI reflects changes immediately
- **Simple architecture** - minimal new code

### Current vs Target
| Aspect | Current | Target |
|--------|---------|--------|
| Data loading | 50/page, server fetch per filter | All records upfront |
| Mutations | Server Action + page refresh | Optimistic + background sync |
| Filter response | 200-500ms (network) | <10ms (in-memory) |

---

## KISS/DRY Review

### Simplifications Made
| Original Proposal | Simplified | Reason |
|-------------------|------------|--------|
| `Map<id, Edition>` | `Edition[]` | Array `.find()` is <1ms for 8K items |
| `pendingUpdates: Map` | `isSaving: boolean` | Single user, no per-item tracking needed |
| Separate `types.ts` | Inline types | Reuse existing `lib/types.ts` |
| Provider component | Direct `useEffect` | Less indirection |
| 2 separate hooks | 1 combined hook | DRY - one import |
| 6 migration phases | 3 phases | Simpler rollout |

### Essential Complexity (Kept)
- **Zustand** - 1KB, simple API, devtools
- **Optimistic updates with rollback** - core requirement
- **Load time measurement** - user requested

---

## Data Volume

| Table | Records | Est. Load Time |
|-------|---------|----------------|
| editions | 7,879 | ~1-2s |
| prints | 44 | ~50ms |
| distributors | 23 | ~50ms |

**Total:** 1-3 seconds (acceptable for dashboard mount)

---

## File Structure

**New files (2):**
```
web/src/lib/store/inventory-store.ts   # Zustand store
web/src/lib/hooks/use-inventory.ts     # Filtering + mutations hook
```

**Modified files (4):**
```
web/src/app/(dashboard)/layout.tsx              # Add initialization
web/src/app/(dashboard)/editions/page.tsx       # Client component
web/src/app/(dashboard)/editions/editions-table.tsx
web/src/app/(dashboard)/editions/[id]/edition-detail.tsx
```

**Deleted (1):**
```
web/src/app/(dashboard)/editions/actions.ts     # No longer needed
```

---

## Implementation

### Store (`inventory-store.ts`)

```typescript
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
        const [editionsRes, printsRes, distributorsRes] = await Promise.all([
          supabase.from('editions').select('*').order('id'),
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
      const { editions } = get()
      const index = editions.findIndex(e => e.id === id)
      if (index === -1) return false

      const previous = editions[index]

      // Optimistic update
      const newEditions = [...editions]
      newEditions[index] = { ...previous, ...updates, updated_at: new Date().toISOString() }
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
      const { editions } = get()
      const targets = ids.map(id => ({
        index: editions.findIndex(e => e.id === id),
        previous: editions.find(e => e.id === id)
      })).filter(t => t.index !== -1 && t.previous)

      if (targets.length === 0) return false

      // Optimistic update
      const newEditions = [...editions]
      targets.forEach(({ index, previous }) => {
        newEditions[index] = { ...previous!, ...updates, updated_at: new Date().toISOString() }
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
```

### Hook (`use-inventory.ts`)

```typescript
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
    markSold: (id: number, price: number, date: string) =>
      store.updateEdition(id, { is_sold: true, retail_price: price, date_sold: date }),
    moveToGallery: (ids: number[], distributorId: number) =>
      store.updateEditions(ids, {
        distributor_id: distributorId,
        date_in_gallery: new Date().toISOString().split('T')[0]
      }),
  }
}
```

### Layout Integration

```typescript
// layout.tsx - becomes client component
'use client'
import { useEffect } from 'react'
import { useInventoryStore } from '@/lib/store/inventory-store'

export default function DashboardLayout({ children }) {
  const { initialize, isLoading, isReady, error, loadTimeMs } = useInventoryStore()

  useEffect(() => { initialize() }, [initialize])

  if (!isReady && isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      Loading inventory...
    </div>
  }

  if (error) {
    return <div className="p-8 text-center">
      <p className="text-red-600 mb-4">Failed: {error}</p>
      <button onClick={initialize}>Retry</button>
    </div>
  }

  return <>
    {children}
    {loadTimeMs && <div className="fixed bottom-4 right-4 text-xs text-muted-foreground">
      Loaded in {loadTimeMs}ms
    </div>}
  </>
}
```

---

## Migration (3 Phases)

### Phase 1: Add Store
1. `npm install zustand`
2. Create `lib/store/inventory-store.ts`
3. Create `lib/hooks/use-inventory.ts`
4. Add initialization to layout

### Phase 2: Convert Pages
1. Convert `editions/page.tsx` to client component
2. Use `useInventory(filters)` for data
3. Use mutations from hook
4. Update table and detail components

### Phase 3: Cleanup
1. Delete `editions/actions.ts`
2. Remove old server fetch code

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Update fails | Rollback to previous, return `false` |
| Load fails | Show error, allow retry |
| Offline | Optimistic update, rollback on sync failure |

Usage:
```typescript
const success = await update(id, { is_printed: true })
if (!success) toast.error('Update failed')
```

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Initial load | < 3 seconds |
| Filter response | < 50ms |
| Optimistic update | Instant |

---

## Testing Checklist

- [ ] Load completes, time displayed
- [ ] All editions visible and filterable
- [ ] Single/batch updates work
- [ ] Rollback works on failure
- [ ] Page refresh reloads correctly

---

## Scalability

**Current (8K):** Works great

**If >50K records:**
- Add virtual scrolling (react-virtual)
- Server-side text search

**If multiple users:**
- `updated_at` conflict detection
- Supabase Realtime

---

## API Summary

```typescript
// Direct store access
useInventoryStore()
  .editions         // EditionWithRelations[]
  .isReady          // boolean
  .isSaving         // boolean
  .loadTimeMs       // number | null
  .initialize()     // Promise<void>
  .updateEdition()  // Promise<boolean>
  .updateEditions() // Promise<boolean>

// Hook with filtering
useInventory(filters?)
  .editions         // filtered array
  .update()         // single update
  .updateMany()     // batch update
  .markPrinted()    // convenience
  .moveToGallery()  // convenience
```
