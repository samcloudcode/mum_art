# Project Requirements Plan: Migrate Dashboard Pages to Client-Side Cache

## Overview

Migrate remaining dashboard pages to use the Zustand inventory cache for instant data access and cross-page consistency.

### Goals
- **Cross-page consistency** - Changes on `/editions` immediately reflected on `/galleries`, `/artworks`
- **Instant navigation** - No loading spinners when switching between pages
- **Computed stats** - All aggregations done client-side with `useMemo`

### Current vs Target
| Page | Current | Target |
|------|---------|--------|
| `/artworks` | Server fetch + stats calculation | Client component + `useInventory()` |
| `/artworks/[id]` | Server fetch | Client component + filter by `print_id` |
| `/galleries` | Server fetch + stats calculation | Client component + `useInventory()` |
| `/galleries/[id]` | Server fetch | Client component + filter by `distributor_id` |
| `/sales` | Server fetch + grouping | Keep server fetch OR move grouping to client |
| `/` (overview) | Static placeholder | Live stats from cache |

---

## Existing Pattern to Follow

The `/editions` page has already been migrated. Use it as the template:

### Pattern: `web/src/app/(dashboard)/editions/page.tsx`
```typescript
'use client'

import { useState, useMemo } from 'react'
import { useInventory } from '@/lib/hooks/use-inventory'
import type { EditionFilters } from '@/lib/types'

export default function EditionsPage() {
  const [filters, setFilters] = useState<EditionFilters>({})

  const {
    editions,
    prints,
    distributors,
    isReady,
    isSaving,
    markPrinted,
    moveToGallery,
  } = useInventory(filters)

  if (!isReady) {
    return null // InventoryProvider handles the loading state
  }

  // ... render with data from hook
}
```

### Key Points:
1. Add `'use client'` directive
2. Use `useInventory()` hook (with optional filters)
3. Return `null` if `!isReady` (layout handles loading)
4. Use `useMemo` for computed stats
5. Props callback functions for mutations (not server actions)

---

## Available Data from Cache

The `useInventory()` hook provides:

```typescript
{
  // Data
  editions: EditionWithRelations[]    // filtered by filters param
  allEditions: EditionWithRelations[] // all editions
  prints: Print[]
  distributors: Distributor[]

  // Status
  isReady: boolean
  isLoading: boolean
  isSaving: boolean
  loadTimeMs: number | null
  error: string | null

  // Mutations
  update: (id: number, updates: Partial<Edition>) => Promise<boolean>
  updateMany: (ids: number[], updates: Partial<Edition>) => Promise<boolean>
  markPrinted: (ids: number[]) => Promise<boolean>
  markNotPrinted: (ids: number[]) => Promise<boolean>
  markSold: (id: number, price: number, date: string, commission?: number) => Promise<boolean>
  moveToGallery: (ids: number[], distributorId: number, date?: string) => Promise<boolean>
  markSettled: (ids: number[], note?: string) => Promise<boolean>
}
```

---

## Implementation Tasks

### Task 1: `/artworks` Page

**File:** `web/src/app/(dashboard)/artworks/page.tsx`

**Current server-side logic to migrate:**
```typescript
// Stats calculation - move to useMemo
const statsMap = new Map<number, { total: number; printed: number; sold: number }>()
editionStats?.forEach((edition) => {
  const current = statsMap.get(edition.print_id) || { total: 0, printed: 0, sold: 0 }
  current.total++
  if (edition.is_printed) current.printed++
  if (edition.is_sold) current.sold++
  statsMap.set(edition.print_id, current)
})
```

**New implementation:**
```typescript
'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useInventory } from '@/lib/hooks/use-inventory'
import { getThumbnailUrl } from '@/lib/supabase/storage'

export default function ArtworksPage() {
  const { prints, allEditions, isReady } = useInventory()

  // Calculate stats per print
  const statsMap = useMemo(() => {
    const map = new Map<number, { total: number; printed: number; sold: number }>()
    allEditions.forEach((edition) => {
      const current = map.get(edition.print_id) || { total: 0, printed: 0, sold: 0 }
      current.total++
      if (edition.is_printed) current.printed++
      if (edition.is_sold) current.sold++
      map.set(edition.print_id, current)
    })
    return map
  }, [allEditions])

  if (!isReady) return null

  // ... rest of render (keep existing JSX, just use prints and statsMap)
}
```

---

### Task 2: `/artworks/[id]` Page

**File:** `web/src/app/(dashboard)/artworks/[id]/page.tsx`

**Changes needed:**
1. Convert to client component
2. Use `use(params)` instead of `await params`
3. Find print from `prints` array
4. Filter editions by `print_id`
5. Calculate stats with `useMemo`

**New implementation pattern:**
```typescript
'use client'

import { use, useMemo } from 'react'
import { useInventory } from '@/lib/hooks/use-inventory'

export default function ArtworkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { prints, allEditions, distributors, isReady } = useInventory()

  const print = useMemo(
    () => prints.find(p => p.id === parseInt(id)),
    [prints, id]
  )

  const editions = useMemo(
    () => allEditions.filter(e => e.print_id === parseInt(id)),
    [allEditions, id]
  )

  // Calculate stats
  const stats = useMemo(() => {
    const total = editions.length
    const printed = editions.filter(e => e.is_printed).length
    const sold = editions.filter(e => e.is_sold).length
    const settled = editions.filter(e => e.is_settled).length
    return { total, printed, sold, settled, available: total - sold }
  }, [editions])

  // Group by location
  const locationGroups = useMemo(() => {
    const groups = new Map<string, { count: number; sold: number }>()
    editions.forEach(e => {
      const loc = e.distributors?.name || 'Unassigned'
      const current = groups.get(loc) || { count: 0, sold: 0 }
      current.count++
      if (e.is_sold) current.sold++
      groups.set(loc, current)
    })
    return groups
  }, [editions])

  if (!isReady) return null
  if (!print) return <NotFound />

  // ... rest of render
}
```

---

### Task 3: `/galleries` Page

**File:** `web/src/app/(dashboard)/galleries/page.tsx`

**Stats calculation to migrate:**
```typescript
const statsMap = new Map<number, {
  total: number
  sold: number
  inStock: number
  unsettledCount: number
  unsettledAmount: number
  stockValue: number
}>()
```

**New implementation:**
```typescript
'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'

export default function GalleriesPage() {
  const { distributors, allEditions, isReady } = useInventory()

  const statsMap = useMemo(() => {
    const map = new Map<number, {
      total: number
      sold: number
      inStock: number
      unsettledCount: number
      unsettledAmount: number
      stockValue: number
    }>()

    allEditions.forEach((edition) => {
      if (!edition.distributor_id) return
      const current = map.get(edition.distributor_id) || {
        total: 0, sold: 0, inStock: 0,
        unsettledCount: 0, unsettledAmount: 0, stockValue: 0
      }
      current.total++
      if (edition.is_sold) {
        current.sold++
        if (!edition.is_settled && edition.retail_price) {
          current.unsettledCount++
          const commission = edition.commission_percentage || 0
          current.unsettledAmount += edition.retail_price * (1 - commission / 100)
        }
      } else if (edition.is_printed) {
        current.inStock++
        if (edition.retail_price) {
          current.stockValue += edition.retail_price
        }
      }
      map.set(edition.distributor_id, current)
    })
    return map
  }, [allEditions])

  if (!isReady) return null

  // ... rest of render (keep existing JSX)
}
```

---

### Task 4: `/galleries/[id]` Page

**File:** `web/src/app/(dashboard)/galleries/[id]/page.tsx`

**Changes needed:**
1. Convert to client component
2. Find distributor from `distributors` array
3. Filter editions by `distributor_id`
4. Add mutation for "Mark All as Paid" button

**New implementation:**
```typescript
'use client'

import { use, useMemo } from 'react'
import { useInventory } from '@/lib/hooks/use-inventory'

export default function GalleryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { distributors, allEditions, isReady, markSettled, isSaving } = useInventory()

  const distributor = useMemo(
    () => distributors.find(d => d.id === parseInt(id)),
    [distributors, id]
  )

  const editions = useMemo(
    () => allEditions
      .filter(e => e.distributor_id === parseInt(id))
      .sort((a, b) => {
        if (a.is_sold !== b.is_sold) return a.is_sold ? 1 : -1
        return a.edition_display_name.localeCompare(b.edition_display_name)
      }),
    [allEditions, id]
  )

  const { inStock, sold, unsettled, stockValue, totalRevenue, unsettledAmount } = useMemo(() => {
    const inStock = editions.filter(e => e.is_printed && !e.is_sold)
    const sold = editions.filter(e => e.is_sold)
    const unsettled = sold.filter(e => !e.is_settled)

    const stockValue = inStock.reduce((sum, e) => sum + (e.retail_price || 0), 0)
    const totalRevenue = sold.reduce((sum, e) => sum + (e.retail_price || 0), 0)
    const unsettledAmount = unsettled.reduce((sum, e) => {
      const commission = e.commission_percentage || distributor?.commission_percentage || 0
      return sum + (e.retail_price || 0) * (1 - commission / 100)
    }, 0)

    return { inStock, sold, unsettled, stockValue, totalRevenue, unsettledAmount }
  }, [editions, distributor])

  const handleMarkAllAsPaid = async () => {
    const ids = unsettled.map(e => e.id)
    await markSettled(ids)
  }

  if (!isReady) return null
  if (!distributor) return <NotFound />

  // ... rest of render
}
```

---

### Task 5: `/sales` Page (Optional)

**File:** `web/src/app/(dashboard)/sales/page.tsx`

**Decision:** The sales page does complex monthly grouping. Two options:

**Option A: Keep server-side** (simpler, current approach)
- Sales page is read-only aggregation
- Server fetch is acceptable for initial load
- `SalesByMonth` component already uses cache for `markSettled`

**Option B: Move to client** (full consistency)
- Convert to client component
- Move grouping logic to `useMemo`
- Filter `allEditions.filter(e => e.is_sold)`

**Recommendation:** Keep server-side for now. The `SalesByMonth` component already uses the cache for mutations, so updates work correctly.

---

### Task 6: `/` (Overview Page)

**File:** `web/src/app/(dashboard)/page.tsx`

**Currently:** Static placeholder with loading skeletons

**New implementation:**
```typescript
'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'

export default function DashboardPage() {
  const { allEditions, distributors, isReady } = useInventory()

  const stats = useMemo(() => {
    const total = allEditions.length
    const sold = allEditions.filter(e => e.is_sold).length
    const totalRevenue = allEditions
      .filter(e => e.is_sold && e.retail_price)
      .reduce((sum, e) => sum + (e.retail_price || 0), 0)
    const unsettledAmount = allEditions
      .filter(e => e.is_sold && !e.is_settled && e.retail_price)
      .reduce((sum, e) => {
        const commission = e.commission_percentage || 0
        return sum + (e.retail_price || 0) * (1 - commission / 100)
      }, 0)
    return { total, sold, totalRevenue, unsettledAmount }
  }, [allEditions])

  // Top galleries by stock
  const topGalleries = useMemo(() => {
    const stockByGallery = new Map<number, { name: string; count: number }>()
    allEditions.forEach(e => {
      if (!e.distributor_id || e.is_sold || !e.is_printed) return
      const dist = distributors.find(d => d.id === e.distributor_id)
      if (!dist) return
      const current = stockByGallery.get(e.distributor_id) || { name: dist.name, count: 0 }
      current.count++
      stockByGallery.set(e.distributor_id, current)
    })
    return Array.from(stockByGallery.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
  }, [allEditions, distributors])

  if (!isReady) return null

  // ... render with live stats
}
```

---

## File Changes Summary

| File | Action |
|------|--------|
| `web/src/app/(dashboard)/artworks/page.tsx` | Convert to client component |
| `web/src/app/(dashboard)/artworks/[id]/page.tsx` | Convert to client component |
| `web/src/app/(dashboard)/galleries/page.tsx` | Convert to client component |
| `web/src/app/(dashboard)/galleries/[id]/page.tsx` | Convert to client component |
| `web/src/app/(dashboard)/page.tsx` | Convert to client component |
| `web/src/app/(dashboard)/sales/page.tsx` | Keep as-is (optional) |

---

## Validation Gates

```bash
# Build check
cd web && npm run build

# Type check
cd web && npx tsc --noEmit

# Dev server test
cd web && npm run dev &
```

### Manual Testing Checklist
- [ ] `/artworks` - Grid loads with correct stats per print
- [ ] `/artworks/[id]` - Detail page shows editions grouped by location
- [ ] `/galleries` - Grid loads with correct stock/sold/unsettled stats
- [ ] `/galleries/[id]` - Stock table and unsettled sales load
- [ ] `/galleries/[id]` - "Mark All as Paid" button works
- [ ] `/` - Overview shows live stats
- [ ] Cross-page: Move edition on `/editions`, verify `/galleries` updates

---

## Error Handling

All pages should handle the same error states:

| Scenario | Behavior |
|----------|----------|
| `!isReady` | Return `null` (InventoryProvider shows loading) |
| Entity not found | Show "Not Found" message with back link |
| Mutation fails | Toast error, cache rolled back automatically |

---

## Performance Notes

- `useMemo` dependencies must be stable (arrays from store are stable)
- Stats calculations are O(n) where n = ~8K editions
- Filtering by ID is O(n) - acceptable for this scale
- If needed later: add computed selectors to Zustand store

---

## Confidence Score: 9/10

**Why 9:**
- Clear pattern established in `/editions` migration
- All data already in cache
- Straightforward conversion (server → client)
- No new dependencies needed

**Risk:**
- `ArtworkImageSection` component may have server-only dependencies (check if it uses server client)
