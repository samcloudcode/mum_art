'use client'

import { useState, useMemo, useCallback, type ReactNode } from 'react'
import { Plus, Search, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useInventory } from '@/lib/hooks/use-inventory'
import type { EditionWithRelations } from '@/lib/types'

type Props = {
  distributorId: number
  distributorName: string
  trigger?: ReactNode
}

export function AddEditionsToGalleryDialog({
  distributorId,
  distributorName,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dateInGallery, setDateInGallery] = useState(
    new Date().toISOString().split('T')[0]
  )

  const { allEditions, moveToGallery, isSaving } = useInventory()

  // Get editions that can be moved to this gallery:
  // - Printed (physical copies exist)
  // - Not sold (still available)
  // - Not currently at this gallery
  const availableEditions = useMemo(() => {
    return allEditions.filter(
      (e) =>
        e.is_printed &&
        !e.is_sold &&
        e.distributor_id !== distributorId
    )
  }, [allEditions, distributorId])

  // Filter by search
  const filteredEditions = useMemo(() => {
    if (!search.trim()) return availableEditions

    const searchLower = search.toLowerCase()

    // Smart search: "Artwork 123" or "Artwork #123"
    const smartMatch = search.match(/^(.+?)[\s#-]*(\d+)$/)

    return availableEditions.filter((e) => {
      if (smartMatch) {
        const artworkName = smartMatch[1].trim().toLowerCase()
        const editionNum = parseInt(smartMatch[2])
        if (
          e.edition_number === editionNum &&
          e.prints?.name?.toLowerCase().includes(artworkName)
        ) {
          return true
        }
      }

      // Regular search
      const displayName = e.edition_display_name.toLowerCase()
      const artworkName = e.prints?.name?.toLowerCase() || ''
      const locationName = e.distributors?.name?.toLowerCase() || 'direct'

      return (
        displayName.includes(searchLower) ||
        artworkName.includes(searchLower) ||
        locationName.includes(searchLower)
      )
    })
  }, [availableEditions, search])

  // Group by artwork for easier browsing
  const groupedByArtwork = useMemo(() => {
    const groups = new Map<string, EditionWithRelations[]>()

    for (const edition of filteredEditions) {
      const artworkName = edition.prints?.name || 'Unknown Artwork'
      if (!groups.has(artworkName)) {
        groups.set(artworkName, [])
      }
      groups.get(artworkName)!.push(edition)
    }

    // Sort groups by artwork name, sort editions within each group by edition number
    const sorted = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, editions]) => ({
        artworkName: name,
        editions: editions.sort(
          (a, b) => (a.edition_number || 0) - (b.edition_number || 0)
        ),
      }))

    return sorted
  }, [filteredEditions])

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAllFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const e of filteredEditions) {
        next.add(e.id)
      }
      return next
    })
  }, [filteredEditions])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return

    const ids = Array.from(selectedIds)
    const success = await moveToGallery(ids, distributorId, dateInGallery)

    if (success) {
      setOpen(false)
      setSelectedIds(new Set())
      setSearch('')
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Reset state when closing
      setSelectedIds(new Set())
      setSearch('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Editions
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Editions to {distributorName}</DialogTitle>
          <DialogDescription>
            Search and select printed editions to move to this gallery.
            {availableEditions.length > 0 && (
              <span className="block mt-1">
                {availableEditions.length} editions available to add
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by artwork name or edition number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Selection summary & actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Badge variant="secondary">
                  {selectedIds.size} selected
                </Badge>
              )}
              {filteredEditions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllFiltered}
                  className="text-xs"
                >
                  Select all ({filteredEditions.length})
                </Button>
              )}
              {selectedIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredEditions.length} results
            </span>
          </div>

          {/* Edition list */}
          <div className="flex-1 border rounded-md overflow-y-auto max-h-[40vh]">
            <div className="p-2">
              {groupedByArtwork.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  {search
                    ? 'No editions match your search'
                    : 'No printed editions available to add'}
                </p>
              ) : (
                groupedByArtwork.map(({ artworkName, editions }) => (
                  <div key={artworkName} className="mb-4 last:mb-0">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                      {artworkName}
                    </h4>
                    <div className="space-y-1">
                      {editions.map((edition) => (
                        <label
                          key={edition.id}
                          className={`
                            flex items-center gap-3 p-2 rounded-md cursor-pointer
                            hover:bg-muted/50 transition-colors
                            ${selectedIds.has(edition.id) ? 'bg-muted' : ''}
                          `}
                        >
                          <Checkbox
                            checked={selectedIds.has(edition.id)}
                            onCheckedChange={() => toggleSelection(edition.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">
                              #{edition.edition_number}
                            </span>
                            {edition.size && (
                              <span className="text-muted-foreground ml-2 text-sm">
                                {edition.size}
                              </span>
                            )}
                            {edition.frame_type && (
                              <span className="text-muted-foreground ml-2 text-sm">
                                • {edition.frame_type}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground truncate">
                            {edition.distributors?.name || 'Direct'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label>Date in Gallery</Label>
            <Input
              type="date"
              value={dateInGallery}
              onChange={(e) => setDateInGallery(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || selectedIds.size === 0}
          >
            {isSaving ? (
              'Moving...'
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Add {selectedIds.size} Edition{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
