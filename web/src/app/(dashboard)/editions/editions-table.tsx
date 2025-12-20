'use client'

import { useState } from 'react'
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
import { EditionRowActions } from '@/components/edition-row-actions'
import type { EditionWithRelations, Distributor } from '@/lib/types'

type Props = {
  editions: EditionWithRelations[]
  distributors: Distributor[]
  sizes: string[]
  isSaving: boolean
  onMarkPrinted: (ids: number[]) => Promise<boolean>
  onMarkSold: (id: number, price: number, date: string, commissionPercentage?: number) => Promise<boolean>
  onMarkSettled: (ids: number[], paymentNote?: string) => Promise<boolean>
  onMoveToGallery: (ids: number[], distributorId: number, dateInGallery?: string) => Promise<boolean>
  onUpdateSize: (ids: number[], size: string) => Promise<boolean>
}

const PAGE_SIZE = 50

export function EditionsTable({
  editions,
  distributors,
  sizes,
  isSaving,
  onMarkPrinted,
  onMarkSold,
  onMarkSettled,
  onMoveToGallery,
  onUpdateSize,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [showSizeDialog, setShowSizeDialog] = useState(false)
  const [moveToDistributorId, setMoveToDistributorId] = useState('')
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split('T')[0])
  const [bulkSize, setBulkSize] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Client-side pagination
  const totalPages = Math.ceil(editions.length / PAGE_SIZE)
  const startIndex = (page - 1) * PAGE_SIZE
  const paginatedEditions = editions.slice(startIndex, startIndex + PAGE_SIZE)

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedEditions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedEditions.map((e) => e.id)))
    }
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return `£${price.toLocaleString()}`
  }

  const startItem = startIndex + 1
  const endItem = Math.min(startIndex + PAGE_SIZE, editions.length)

  const handleMarkAsPrinted = async () => {
    setActionError(null)
    const success = await onMarkPrinted(Array.from(selectedIds))
    if (success) {
      setSelectedIds(new Set())
    } else {
      setActionError('Failed to mark as printed')
    }
  }

  const handleMoveToGallery = async () => {
    if (!moveToDistributorId) return
    setActionError(null)
    const success = await onMoveToGallery(
      Array.from(selectedIds),
      parseInt(moveToDistributorId),
      moveDate
    )
    if (success) {
      setSelectedIds(new Set())
      setShowMoveDialog(false)
      setMoveToDistributorId('')
    } else {
      setActionError('Failed to move editions')
    }
  }

  const handleMarkAsSettled = async () => {
    setActionError(null)
    const success = await onMarkSettled(Array.from(selectedIds))
    if (success) {
      setSelectedIds(new Set())
    } else {
      setActionError('Failed to mark as settled')
    }
  }

  const handleChangeSize = async () => {
    if (!bulkSize) return
    setActionError(null)
    const success = await onUpdateSize(Array.from(selectedIds), bulkSize)
    if (success) {
      setSelectedIds(new Set())
      setShowSizeDialog(false)
      setBulkSize('')
    } else {
      setActionError('Failed to change size')
    }
  }

  const goToPage = (newPage: number) => {
    setPage(newPage)
    setSelectedIds(new Set()) // Clear selection when changing pages
  }

  return (
    <div className="space-y-4">
      {/* Error message */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      {/* Selection actions */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {selectedIds.size} edition{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkAsPrinted}
              disabled={isSaving}
            >
              Mark as Printed
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkAsSettled}
              disabled={isSaving}
            >
              Mark as Settled
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMoveDialog(true)}
              disabled={isSaving}
            >
              Move to Gallery
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSizeDialog(true)}
              disabled={isSaving}
            >
              Change Size
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
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
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMoveToGallery}
              disabled={!moveToDistributorId || isSaving}
            >
              {isSaving ? 'Moving...' : 'Move Editions'}
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
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSizeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleChangeSize}
              disabled={!bulkSize || isSaving}
            >
              {isSaving ? 'Updating...' : 'Update Size'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === paginatedEditions.length && paginatedEditions.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Edition</TableHead>
              <TableHead>Artwork</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Frame</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedEditions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No editions found
                </TableCell>
              </TableRow>
            ) : (
              paginatedEditions.map((edition) => (
                <TableRow key={edition.id} className="group">
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(edition.id)}
                      onCheckedChange={() => toggleSelect(edition.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/editions/${edition.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {edition.edition_display_name}
                    </Link>
                  </TableCell>
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
                  <TableCell>
                    {edition.size ? (
                      <Badge variant="outline">{edition.size}</Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {edition.frame_type || '-'}
                  </TableCell>
                  <TableCell>
                    {edition.distributors ? (
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
                  <TableCell className="text-right font-medium">
                    {formatPrice(edition.retail_price)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {edition.is_sold ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          Sold
                        </Badge>
                      ) : edition.is_printed ? (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                          Printed
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not Printed</Badge>
                      )}
                      {edition.is_sold && !edition.is_settled && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          Unpaid
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <EditionRowActions
                      edition={edition}
                      distributors={distributors}
                      sizes={sizes}
                      onMarkSold={onMarkSold}
                      onMarkSettled={onMarkSettled}
                      onChangeSize={onUpdateSize}
                      onMoveToGallery={onMoveToGallery}
                      onMarkPrinted={onMarkPrinted}
                      isSaving={isSaving}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {editions.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {startItem} to {endItem} of {editions.length.toLocaleString()} editions
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
              {/* Show page numbers */}
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
                    className="w-10"
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
