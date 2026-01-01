'use client'

import { useState, useCallback, useMemo, Fragment, memo } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { EditionRowActions } from '@/components/edition-row-actions'
import { PrintStatusSelect, SaleStatusSelect } from './edition-status-selects'
import { EditionInlineCell } from './edition-inline-cell'
import { EditionExpandableRow } from './edition-expandable-row'
import type { EditionWithRelations, Distributor, EditionUpdate } from '@/lib/types'
import { formatPrice, formatDate } from '@/lib/utils'

type ColumnKey = 'edition' | 'artwork' | 'size' | 'frame' | 'location' | 'price' | 'printed' | 'sale' | 'dateSold' | 'dateInGallery' | 'actions'

type Props = {
  editions: EditionWithRelations[]
  distributors: Distributor[]
  sizes: string[]

  // Feature toggles
  showSelection?: boolean
  showPagination?: boolean
  showExpandableRows?: boolean
  enableInlineEdit?: boolean
  pageSize?: number

  // Column visibility
  columns?: ColumnKey[]

  // Callbacks
  onUpdate: (id: number, updates: EditionUpdate) => Promise<boolean>
  onBulkUpdate?: (ids: number[], updates: EditionUpdate) => Promise<boolean>

  // Row action callbacks (for modal-based actions)
  onMarkSold?: (id: number, price: number, date: string, commissionPercentage?: number) => Promise<boolean>
  onMarkSettled?: (ids: number[], paymentNote?: string) => Promise<boolean>
  onMoveToGallery?: (ids: number[], distributorId: number, dateInGallery?: string) => Promise<boolean>
  onMarkPrinted?: (ids: number[]) => Promise<boolean>

  // State
  isSaving?: boolean
  savingIds?: Set<number> // Optional: per-row saving state
}

const DEFAULT_COLUMNS: ColumnKey[] = ['edition', 'artwork', 'size', 'frame', 'location', 'price', 'printed', 'sale', 'dateSold', 'dateInGallery', 'actions']
const DEFAULT_PAGE_SIZE = 50

// Static options - defined outside component to avoid recreation
const FRAME_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Framed', label: 'Framed' },
  { value: 'Tube only', label: 'Tube only' },
  { value: 'Mounted', label: 'Mounted' },
]

// Props for the memoized row component
type EditionTableRowProps = {
  edition: EditionWithRelations
  isSelected: boolean
  isExpanded: boolean
  showSelection: boolean
  showExpandableRows: boolean
  enableInlineEdit: boolean
  columns: ColumnKey[]
  sizeOptions: Array<{ value: string; label: string }>
  distributorOptions: Array<{ value: number; label: string }>
  onToggleSelect: (id: number) => void
  onToggleExpand: (id: number) => void
  onInlineSave: (id: number, field: string, value: unknown) => Promise<boolean>
  onUpdate: (id: number, updates: EditionUpdate) => Promise<boolean>
  onMarkSold?: (id: number, price: number, date: string, commissionPercentage?: number) => Promise<boolean>
  onMarkSettled?: (ids: number[], paymentNote?: string) => Promise<boolean>
  onMoveToGallery?: (ids: number[], distributorId: number, dateInGallery?: string) => Promise<boolean>
  onMarkPrinted?: (ids: number[]) => Promise<boolean>
  onBulkUpdate?: (ids: number[], updates: EditionUpdate) => Promise<boolean>
  distributors: Distributor[]
  sizes: string[]
  isSaving: boolean
}

// Performance debugging - set to true via localStorage to enable
// In browser console: localStorage.setItem('DEBUG_TABLE_RENDERS', 'true')
const DEBUG_TABLE_RENDERS = typeof window !== 'undefined' && localStorage?.getItem('DEBUG_TABLE_RENDERS') === 'true'
const rowRenderCounts = DEBUG_TABLE_RENDERS ? new Map<number, number>() : null
const prevPropsMap = DEBUG_TABLE_RENDERS ? new Map<number, EditionTableRowProps>() : null

function logPropChanges(id: number, prev: EditionTableRowProps | undefined, next: EditionTableRowProps) {
  if (!prev || !DEBUG_TABLE_RENDERS) return
  const changes: string[] = []

  if (prev.edition !== next.edition) changes.push('edition')
  if (prev.isSelected !== next.isSelected) changes.push('isSelected')
  if (prev.isExpanded !== next.isExpanded) changes.push('isExpanded')
  if (prev.isSaving !== next.isSaving) changes.push('isSaving')
  if (prev.sizeOptions !== next.sizeOptions) changes.push('sizeOptions')
  if (prev.distributorOptions !== next.distributorOptions) changes.push('distributorOptions')
  if (prev.columns !== next.columns) changes.push('columns')
  if (prev.onUpdate !== next.onUpdate) changes.push('onUpdate')
  if (prev.onMarkSold !== next.onMarkSold) changes.push('onMarkSold')
  if (prev.onBulkUpdate !== next.onBulkUpdate) changes.push('onBulkUpdate')
  if (prev.onToggleSelect !== next.onToggleSelect) changes.push('onToggleSelect')
  if (prev.onToggleExpand !== next.onToggleExpand) changes.push('onToggleExpand')
  if (prev.onInlineSave !== next.onInlineSave) changes.push('onInlineSave')
  if (prev.onMarkSettled !== next.onMarkSettled) changes.push('onMarkSettled')
  if (prev.onMoveToGallery !== next.onMoveToGallery) changes.push('onMoveToGallery')
  if (prev.onMarkPrinted !== next.onMarkPrinted) changes.push('onMarkPrinted')
  if (prev.distributors !== next.distributors) changes.push('distributors')
  if (prev.sizes !== next.sizes) changes.push('sizes')

  if (changes.length > 0) {
    console.log(`[ROW ${id}] Props changed:`, changes.join(', '))
  }
}

// Memoized row component - only re-renders when its specific data changes
const EditionTableRow = memo(function EditionTableRow({
  edition,
  isSelected,
  isExpanded,
  showSelection,
  showExpandableRows,
  enableInlineEdit,
  columns,
  sizeOptions,
  distributorOptions,
  onToggleSelect,
  onToggleExpand,
  onInlineSave,
  onUpdate,
  onMarkSold,
  onMarkSettled,
  onMoveToGallery,
  onMarkPrinted,
  onBulkUpdate,
  distributors,
  sizes,
  isSaving,
}: EditionTableRowProps) {
  // Performance debugging - enable via: localStorage.setItem('DEBUG_TABLE_RENDERS', 'true')
  if (DEBUG_TABLE_RENDERS && rowRenderCounts && prevPropsMap) {
    const currentProps: EditionTableRowProps = {
      edition, isSelected, isExpanded, showSelection, showExpandableRows,
      enableInlineEdit, columns, sizeOptions, distributorOptions,
      onToggleSelect, onToggleExpand, onInlineSave, onUpdate, onMarkSold,
      onMarkSettled, onMoveToGallery, onMarkPrinted, onBulkUpdate,
      distributors, sizes, isSaving,
    }
    const prevProps = prevPropsMap.get(edition.id)
    const count = (rowRenderCounts.get(edition.id) || 0) + 1
    rowRenderCounts.set(edition.id, count)

    if (count > 1) {
      console.log(`[ROW RE-RENDER] Edition ${edition.id} rendered ${count} times`)
      logPropChanges(edition.id, prevProps, currentProps)
    }
    prevPropsMap.set(edition.id, currentProps)
  }
  // Memoize callbacks to prevent child re-renders
  const handlePrintedUpdate = useCallback(
    (id: number, isPrinted: boolean) => onUpdate(id, { is_printed: isPrinted }),
    [onUpdate]
  )

  const handleMarkUnsold = useCallback(
    (id: number) => onUpdate(id, {
      is_sold: false,
      is_settled: false,
      date_sold: null,
      commission_percentage: null
    }),
    [onUpdate]
  )

  const handleMarkSettled = useCallback(
    (id: number, isSettled: boolean) => onUpdate(id, { is_settled: isSettled }),
    [onUpdate]
  )

  const handleChangeSize = useCallback(
    (ids: number[], size: string) => {
      if (!onBulkUpdate) return Promise.resolve(false)
      return onBulkUpdate(ids, { size })
    },
    [onBulkUpdate]
  )

  return (
    <TableRow className="group border-l-2 border-l-transparent hover:border-l-accent hover:bg-secondary/30 transition-all duration-200">
      {showExpandableRows && (
        <TableCell className="w-10">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onToggleExpand(edition.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
      )}
      {showSelection && (
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(edition.id)}
          />
        </TableCell>
      )}
      {columns.includes('edition') && (
        <TableCell>
          <Link
            href={`/editions/${edition.id}`}
            className="font-serif text-primary hover:text-accent transition-colors"
          >
            {edition.edition_display_name}
          </Link>
        </TableCell>
      )}
      {columns.includes('artwork') && (
        <TableCell>
          {edition.prints ? (
            <Link
              href={`/artworks/${edition.prints.id}`}
              className="text-gray-700 hover:underline"
            >
              {edition.prints.name}
            </Link>
          ) : (
            '-'
          )}
        </TableCell>
      )}
      {columns.includes('size') && (
        <TableCell>
          {enableInlineEdit ? (
            <EditionInlineCell
              type="select"
              editionId={edition.id}
              field="size"
              value={edition.size}
              options={sizeOptions}
              placeholder="Size"
              onSave={onInlineSave}
            />
          ) : (
            edition.size ? (
              <Badge variant="outline">{edition.size}</Badge>
            ) : (
              '-'
            )
          )}
        </TableCell>
      )}
      {columns.includes('frame') && (
        <TableCell>
          {enableInlineEdit ? (
            <EditionInlineCell
              type="select"
              editionId={edition.id}
              field="frame_type"
              value={edition.frame_type}
              options={FRAME_TYPE_OPTIONS}
              placeholder="Frame"
              onSave={onInlineSave}
            />
          ) : (
            <span className="text-gray-600">{edition.frame_type || '-'}</span>
          )}
        </TableCell>
      )}
      {columns.includes('location') && (
        <TableCell>
          {enableInlineEdit ? (
            <EditionInlineCell
              type="select"
              editionId={edition.id}
              field="distributor_id"
              value={edition.distributor_id}
              options={distributorOptions}
              placeholder="Location"
              onSave={onInlineSave}
            />
          ) : edition.distributors ? (
            <Link
              href={`/galleries/${edition.distributors.id}`}
              className="text-gray-700 hover:underline"
            >
              {edition.distributors.name}
            </Link>
          ) : (
            '-'
          )}
        </TableCell>
      )}
      {columns.includes('price') && (
        <TableCell className="text-right">
          {enableInlineEdit ? (
            <EditionInlineCell
              type="number"
              editionId={edition.id}
              field="retail_price"
              value={edition.retail_price}
              prefix="£"
              onSave={onInlineSave}
              className="text-right"
            />
          ) : (
            <span className="font-serif tabular-nums">{formatPrice(edition.retail_price)}</span>
          )}
        </TableCell>
      )}
      {columns.includes('printed') && (
        <TableCell>
          <PrintStatusSelect
            edition={edition}
            onUpdate={handlePrintedUpdate}
            disabled={isSaving}
          />
        </TableCell>
      )}
      {columns.includes('sale') && onMarkSold && (
        <TableCell>
          <SaleStatusSelect
            edition={edition}
            onMarkSold={onMarkSold}
            onMarkUnsold={handleMarkUnsold}
            onMarkSettled={handleMarkSettled}
            disabled={isSaving}
          />
        </TableCell>
      )}
      {columns.includes('dateSold') && (
        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(edition.date_sold)}
        </TableCell>
      )}
      {columns.includes('dateInGallery') && (
        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(edition.date_in_gallery)}
        </TableCell>
      )}
      {columns.includes('actions') && onMarkSold && onMarkSettled && onMoveToGallery && onMarkPrinted && onBulkUpdate && (
        <TableCell>
          <EditionRowActions
            edition={edition}
            distributors={distributors}
            sizes={sizes}
            onMarkSold={onMarkSold}
            onMarkSettled={onMarkSettled}
            onChangeSize={handleChangeSize}
            onMoveToGallery={onMoveToGallery}
            onMarkPrinted={onMarkPrinted}
            isSaving={isSaving}
          />
        </TableCell>
      )}
    </TableRow>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if this specific row's data changed
  // IMPORTANT: All callbacks must be memoized by parent, or this check will fail
  const equal = (
    // Row data - changes frequently per-row
    prevProps.edition === nextProps.edition &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isSaving === nextProps.isSaving &&
    // Options for inline edits - should be memoized
    prevProps.sizeOptions === nextProps.sizeOptions &&
    prevProps.distributorOptions === nextProps.distributorOptions &&
    // Config flags (rarely change)
    prevProps.showSelection === nextProps.showSelection &&
    prevProps.showExpandableRows === nextProps.showExpandableRows &&
    prevProps.enableInlineEdit === nextProps.enableInlineEdit &&
    prevProps.columns === nextProps.columns &&
    // ALL callbacks must be compared - parent must memoize these
    prevProps.onUpdate === nextProps.onUpdate &&
    prevProps.onMarkSold === nextProps.onMarkSold &&
    prevProps.onBulkUpdate === nextProps.onBulkUpdate &&
    prevProps.onToggleSelect === nextProps.onToggleSelect &&
    prevProps.onToggleExpand === nextProps.onToggleExpand &&
    prevProps.onInlineSave === nextProps.onInlineSave &&
    prevProps.onMarkSettled === nextProps.onMarkSettled &&
    prevProps.onMoveToGallery === nextProps.onMoveToGallery &&
    prevProps.onMarkPrinted === nextProps.onMarkPrinted &&
    // Arrays - should be memoized or excluded if not used
    prevProps.distributors === nextProps.distributors &&
    prevProps.sizes === nextProps.sizes
  )
  return equal
})

export function EditionsDataTable({
  editions,
  distributors,
  sizes,
  showSelection = true,
  showPagination = true,
  showExpandableRows = true,
  enableInlineEdit = true,
  pageSize = DEFAULT_PAGE_SIZE,
  columns = DEFAULT_COLUMNS,
  onUpdate,
  onBulkUpdate,
  onMarkSold,
  onMarkSettled,
  onMoveToGallery,
  onMarkPrinted,
  isSaving = false,
  savingIds,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [showSizeDialog, setShowSizeDialog] = useState(false)
  const [moveToDistributorId, setMoveToDistributorId] = useState('')
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split('T')[0])
  const [bulkSize, setBulkSize] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<'printed' | 'settled' | 'move' | 'size' | null>(null)
  const [page, setPage] = useState(1)

  // Client-side pagination - memoized to prevent unnecessary recalculations
  const totalPages = Math.ceil(editions.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const paginatedEditions = useMemo(
    () => showPagination ? editions.slice(startIndex, startIndex + pageSize) : editions,
    [editions, showPagination, startIndex, pageSize]
  )

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const newSelected = new Set(prev)
      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.add(id)
      }
      return newSelected
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === paginatedEditions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedEditions.map((e) => e.id)))
    }
  }, [selectedIds.size, paginatedEditions])

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const handleInlineSave = useCallback(
    async (id: number, field: string, value: unknown): Promise<boolean> => {
      return onUpdate(id, { [field]: value } as EditionUpdate)
    },
    [onUpdate]
  )

  const handleNotesUpdate = useCallback(
    async (id: number, notes: string | null): Promise<boolean> => {
      return onUpdate(id, { notes })
    },
    [onUpdate]
  )

  const startItem = startIndex + 1
  const endItem = Math.min(startIndex + pageSize, editions.length)

  // Bulk action handlers - memoized for stable references
  const handleMarkAsPrinted = useCallback(async () => {
    if (!onMarkPrinted) return
    setActionError(null)
    setActiveAction('printed')
    const success = await onMarkPrinted(Array.from(selectedIds))
    setActiveAction(null)
    if (success) {
      setSelectedIds(new Set())
    } else {
      setActionError('Failed to mark as printed')
    }
  }, [onMarkPrinted, selectedIds])

  const handleMoveToGallery = useCallback(async () => {
    if (!moveToDistributorId || !onMoveToGallery) return
    setActionError(null)
    setActiveAction('move')
    const success = await onMoveToGallery(
      Array.from(selectedIds),
      parseInt(moveToDistributorId),
      moveDate
    )
    setActiveAction(null)
    if (success) {
      setSelectedIds(new Set())
      setShowMoveDialog(false)
      setMoveToDistributorId('')
    } else {
      setActionError('Failed to move editions')
    }
  }, [onMoveToGallery, selectedIds, moveToDistributorId, moveDate])

  const handleMarkAsSettled = useCallback(async () => {
    if (!onMarkSettled) return
    setActionError(null)
    setActiveAction('settled')
    const success = await onMarkSettled(Array.from(selectedIds))
    setActiveAction(null)
    if (success) {
      setSelectedIds(new Set())
    } else {
      setActionError('Failed to mark as settled')
    }
  }, [onMarkSettled, selectedIds])

  const handleChangeSize = useCallback(async () => {
    if (!bulkSize || !onBulkUpdate) return
    setActionError(null)
    setActiveAction('size')
    const success = await onBulkUpdate(Array.from(selectedIds), { size: bulkSize })
    setActiveAction(null)
    if (success) {
      setSelectedIds(new Set())
      setShowSizeDialog(false)
      setBulkSize('')
    } else {
      setActionError('Failed to change size')
    }
  }, [onBulkUpdate, selectedIds, bulkSize])

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage)
    setSelectedIds(new Set())
    setExpandedId(null)
  }, [])

  // Calculate column count for expanded row colspan
  const colCount =
    (showSelection ? 1 : 0) +
    (showExpandableRows ? 1 : 0) +
    columns.length

  // Memoize options arrays to prevent re-renders of child components
  const sizeOptions = useMemo(
    () => sizes.map((s) => ({ value: s, label: s })),
    [sizes]
  )

  const distributorOptions = useMemo(
    () => distributors.map((d) => ({ value: d.id, label: d.name })),
    [distributors]
  )

  return (
    <div className="space-y-4">
      {/* Error message */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      {/* Selection actions */}
      {showSelection && selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border border-accent/20 rounded-lg p-3 shadow-sm flex items-center justify-between">
          <span className="text-sm font-medium text-accent">
            {selectedIds.size} edition{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2 flex-wrap">
            {onMarkPrinted && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkAsPrinted}
                disabled={activeAction !== null}
              >
                {activeAction === 'printed' ? (
                  <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Marking...</>
                ) : (
                  'Mark as Printed'
                )}
              </Button>
            )}
            {onMarkSettled && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkAsSettled}
                disabled={activeAction !== null}
              >
                {activeAction === 'settled' ? (
                  <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Marking...</>
                ) : (
                  'Mark as Settled'
                )}
              </Button>
            )}
            {onMoveToGallery && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowMoveDialog(true)}
                disabled={activeAction !== null}
              >
                Move to Gallery
              </Button>
            )}
            {onBulkUpdate && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSizeDialog(true)}
                disabled={activeAction !== null}
              >
                Change Size
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} disabled={activeAction !== null}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Move to Gallery Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Gallery</DialogTitle>
            <DialogDescription>
              Move {selectedIds.size} edition{selectedIds.size > 1 ? 's' : ''} to a new location
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Destination Gallery</Label>
              <Select value={moveToDistributorId} onValueChange={setMoveToDistributorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gallery" />
                </SelectTrigger>
                <SelectContent>
                  {distributors.map((dist) => (
                    <SelectItem key={dist.id} value={dist.id.toString()}>
                      {dist.name}
                      {dist.commission_percentage !== null && ` (${dist.commission_percentage}%)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date in Gallery</Label>
              <Input
                type="date"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)} disabled={activeAction === 'move'}>
              Cancel
            </Button>
            <Button
              onClick={handleMoveToGallery}
              disabled={!moveToDistributorId || activeAction !== null}
            >
              {activeAction === 'move' ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Moving...</>
              ) : (
                'Move Editions'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Size Dialog */}
      <Dialog open={showSizeDialog} onOpenChange={setShowSizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Size</DialogTitle>
            <DialogDescription>
              Update size for {selectedIds.size} edition{selectedIds.size > 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Size</Label>
              <Select value={bulkSize} onValueChange={setBulkSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {sizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSizeDialog(false)} disabled={activeAction === 'size'}>
              Cancel
            </Button>
            <Button onClick={handleChangeSize} disabled={!bulkSize || activeAction !== null}>
              {activeAction === 'size' ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating...</>
              ) : (
                'Update Size'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="gallery-plaque overflow-x-auto">
        <Table className="min-w-[1200px]">
          <TableHeader className="bg-secondary/50 border-b border-border">
            <TableRow>
              {showExpandableRows && <TableHead className="w-10" />}
              {showSelection && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === paginatedEditions.length && paginatedEditions.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              {columns.includes('edition') && <TableHead>Edition</TableHead>}
              {columns.includes('artwork') && <TableHead>Artwork</TableHead>}
              {columns.includes('size') && <TableHead>Size</TableHead>}
              {columns.includes('frame') && <TableHead>Frame</TableHead>}
              {columns.includes('location') && <TableHead>Location</TableHead>}
              {columns.includes('price') && <TableHead className="text-right">Price</TableHead>}
              {columns.includes('printed') && <TableHead>Printed</TableHead>}
              {columns.includes('sale') && <TableHead>Sale</TableHead>}
              {columns.includes('dateSold') && <TableHead className="whitespace-nowrap">Date Sold</TableHead>}
              {columns.includes('dateInGallery') && <TableHead className="whitespace-nowrap">In Gallery</TableHead>}
              {columns.includes('actions') && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedEditions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-16">
                  <p className="font-serif text-lg text-muted-foreground">No editions found</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your filters</p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedEditions.map((edition) => (
                <Fragment key={edition.id}>
                  <EditionTableRow
                    edition={edition}
                    isSelected={selectedIds.has(edition.id)}
                    isExpanded={expandedId === edition.id}
                    showSelection={showSelection}
                    showExpandableRows={showExpandableRows}
                    enableInlineEdit={enableInlineEdit}
                    columns={columns}
                    sizeOptions={sizeOptions}
                    distributorOptions={distributorOptions}
                    onToggleSelect={toggleSelect}
                    onToggleExpand={toggleExpand}
                    onInlineSave={handleInlineSave}
                    onUpdate={onUpdate}
                    onMarkSold={onMarkSold}
                    onMarkSettled={onMarkSettled}
                    onMoveToGallery={onMoveToGallery}
                    onMarkPrinted={onMarkPrinted}
                    onBulkUpdate={onBulkUpdate}
                    distributors={distributors}
                    sizes={sizes}
                    isSaving={savingIds ? savingIds.has(edition.id) : isSaving}
                  />
                  {showExpandableRows && expandedId === edition.id && (
                    <EditionExpandableRow
                      edition={edition}
                      onUpdateNotes={handleNotesUpdate}
                      colSpan={colCount}
                    />
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && editions.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            <span className="font-serif">{startItem}</span>–<span className="font-serif">{endItem}</span> of{' '}
            <span className="font-serif">{editions.length.toLocaleString()}</span> editions
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => goToPage(pageNum)}
                    className="w-10 font-serif"
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
