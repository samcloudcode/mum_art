'use client'

import { useState, useMemo } from 'react'
import { MobileEditionCard } from './mobile-edition-card'
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
import { Loader2, CheckCircle, Package, MapPin } from 'lucide-react'
import type { EditionWithRelations, Distributor, EditionUpdate } from '@/lib/types'

type Props = {
  editions: EditionWithRelations[]
  distributors: Distributor[]
  pageSize?: number
  onUpdate: (id: number, updates: EditionUpdate) => Promise<boolean>
  onBulkUpdate?: (ids: number[], updates: EditionUpdate) => Promise<boolean>
  onMarkSold?: (id: number, price: number, date: string, commissionPercentage?: number) => Promise<boolean>
  onMarkSettled?: (ids: number[], paymentNote?: string) => Promise<boolean>
  onMoveToGallery?: (ids: number[], distributorId: number, dateInGallery?: string) => Promise<boolean>
  onMarkPrinted?: (ids: number[]) => Promise<boolean>
  isSaving?: boolean
}

const DEFAULT_PAGE_SIZE = 25

export function MobileEditionList({
  editions,
  distributors,
  pageSize = DEFAULT_PAGE_SIZE,
  onMarkSettled,
  onMoveToGallery,
  onMarkPrinted,
  isSaving = false,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [moveToDistributorId, setMoveToDistributorId] = useState('')
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split('T')[0])
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [isSelectMode, setIsSelectMode] = useState(false)

  // Pagination
  const totalPages = Math.ceil(editions.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const paginatedEditions = useMemo(
    () => editions.slice(startIndex, startIndex + pageSize),
    [editions, startIndex, pageSize]
  )

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedEditions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedEditions.map(e => e.id)))
    }
  }

  const handleMarkAsPrinted = async () => {
    if (!onMarkPrinted) return
    setActiveAction('printed')
    const success = await onMarkPrinted(Array.from(selectedIds))
    setActiveAction(null)
    if (success) {
      setSelectedIds(new Set())
      setIsSelectMode(false)
    }
  }

  const handleMarkAsSettled = async () => {
    if (!onMarkSettled) return
    setActiveAction('settled')
    const success = await onMarkSettled(Array.from(selectedIds))
    setActiveAction(null)
    if (success) {
      setSelectedIds(new Set())
      setIsSelectMode(false)
    }
  }

  const handleMoveToGallery = async () => {
    if (!moveToDistributorId || !onMoveToGallery) return
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
      setIsSelectMode(false)
    }
  }

  const exitSelectMode = () => {
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }

  return (
    <div className="space-y-4">
      {/* Select mode toggle & actions */}
      <div className="flex items-center justify-between gap-2">
        {isSelectMode ? (
          <>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.size === paginatedEditions.length && paginatedEditions.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={exitSelectMode}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">
              {editions.length.toLocaleString()} editions
            </span>
            <Button variant="outline" size="sm" onClick={() => setIsSelectMode(true)}>
              Select
            </Button>
          </>
        )}
      </div>

      {/* Bulk action bar - fixed at bottom when items selected */}
      {isSelectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 bg-card border border-accent/30 rounded-xl shadow-lg p-4 safe-area-inset-bottom">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-accent">
              {selectedIds.size} edition{selectedIds.size > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {onMarkPrinted && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkAsPrinted}
                disabled={activeAction !== null}
                className="flex-col h-auto py-3 gap-1"
              >
                {activeAction === 'printed' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
                <span className="text-xs">Printed</span>
              </Button>
            )}
            {onMarkSettled && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkAsSettled}
                disabled={activeAction !== null}
                className="flex-col h-auto py-3 gap-1"
              >
                {activeAction === 'settled' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <span className="text-xs">Settled</span>
              </Button>
            )}
            {onMoveToGallery && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowMoveDialog(true)}
                disabled={activeAction !== null}
                className="flex-col h-auto py-3 gap-1"
              >
                <MapPin className="h-4 w-4" />
                <span className="text-xs">Move</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Move to Gallery Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="mx-4 rounded-xl">
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
          <DialogFooter className="gap-2">
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

      {/* Edition cards */}
      <div className="space-y-3">
        {paginatedEditions.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-serif text-lg text-muted-foreground">No editions found</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          paginatedEditions.map((edition) => (
            <div key={edition.id} className="flex items-start gap-3">
              {isSelectMode && (
                <div className="pt-4">
                  <Checkbox
                    checked={selectedIds.has(edition.id)}
                    onCheckedChange={() => toggleSelect(edition.id)}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <MobileEditionCard
                  edition={edition}
                  showLocation
                  showPrice
                  showStatus
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {editions.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isSaving}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isSaving}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
