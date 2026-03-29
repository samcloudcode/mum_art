# Plan: Bulk Edit Dialog for Editions Table

## Context
Users frequently need to set the same value (size, frame type, price) across many edition rows. The current "Change Size" button only handles one field. This extends it into a general "Bulk Edit" dialog covering the three most commonly repeated fields: size, frame type, and retail price. Only fields the user explicitly sets are applied — blanks leave existing values untouched.

## Critical File
`web/src/components/editions/editions-data-table.tsx`

No other files need changing. `onBulkUpdate` already accepts any `EditionUpdate` fields and the backend (`inventory-store.ts`) handles arbitrary field updates via Supabase `.update().in('id', ids)`.

---

## Changes (4 surgical edits to one file)

### 1. State variables (~line 488-493)
Replace `showSizeDialog` + `bulkSize` + `activeAction` type:

```typescript
// Remove:
const [showSizeDialog, setShowSizeDialog] = useState(false)
const [bulkSize, setBulkSize] = useState('')
// activeAction type: '...' | 'size' | null

// Add:
const [showBulkEditDialog, setShowBulkEditDialog] = useState(false)
const [bulkSize, setBulkSize] = useState('')
const [bulkFrameType, setBulkFrameType] = useState('')
const [bulkRetailPrice, setBulkRetailPrice] = useState('')
// activeAction type: '...' | 'bulkEdit' | null
```

### 2. Handler (~lines 596-609)
Replace `handleChangeSize` with `handleBulkEdit`:

```typescript
const handleBulkEdit = useCallback(async () => {
  if (!onBulkUpdate) return
  const updates: EditionUpdate = {}
  if (bulkSize) updates.size = bulkSize
  if (bulkFrameType) updates.frame_type = bulkFrameType
  if (bulkRetailPrice !== '') {
    const parsed = parseFloat(bulkRetailPrice)
    if (!isNaN(parsed)) updates.retail_price = parsed
  }
  if (Object.keys(updates).length === 0) return
  setActionError(null)
  setActiveAction('bulkEdit')
  const success = await onBulkUpdate(Array.from(selectedIds), updates)
  setActiveAction(null)
  if (success) {
    setSelectedIds(new Set())
    setShowBulkEditDialog(false)
    setBulkSize('')
    setBulkFrameType('')
    setBulkRetailPrice('')
  } else {
    setActionError('Failed to update editions')
  }
}, [onBulkUpdate, selectedIds, bulkSize, bulkFrameType, bulkRetailPrice])
```

### 3. Toolbar button (~lines 688-697)
```tsx
// Change onClick and label:
onClick={() => setShowBulkEditDialog(true)}
// Label: "Bulk Edit"
```

### 4. Dialog (~lines 758-797)
Replace the "Change Size Dialog" with a "Bulk Edit Dialog" containing three optional fields:

- **Size** — Select with `placeholder="Leave unchanged"`, populates from `sizes` prop
- **Frame Type** — Select with `placeholder="Leave unchanged"`, uses existing `FRAME_TYPE_OPTIONS`
- **Retail Price** — Number input with `£` prefix, `placeholder="Leave unchanged"`

Key dialog behaviours:
- `onOpenChange` resets all three fields when dismissed (escape, backdrop, cancel)
- "Apply Changes" button disabled unless at least one field is set
- Loading state uses `activeAction === 'bulkEdit'`
- Description copy: *"Only fields you set will be changed — blank fields are left as-is."*

No new imports needed — `Input`, `Label`, `Select`, `Dialog`, `Loader2` all already imported.

---

## Verification
1. Run `cd web && npm run dev`
2. Navigate to Editions page
3. Select multiple rows → sticky toolbar appears
4. Click "Bulk Edit" → dialog opens with 3 fields, all blank/placeholder
5. Set only Size → Apply → only size changes, frame/price untouched
6. Set Size + Frame Type → Apply → both change
7. Leave all blank → "Apply Changes" button stays disabled
8. Press Escape → dialog closes and fields reset
