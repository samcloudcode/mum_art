'use client'

import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EditionWithRelations, Distributor } from '@/lib/types'

type Props = {
  edition: EditionWithRelations
  distributors: Distributor[]
  sizes: string[]
  onMarkSold: (id: number, price: number, date: string, commissionPercentage?: number) => Promise<boolean>
  onMarkSettled: (ids: number[]) => Promise<boolean>
  onChangeSize: (ids: number[], size: string) => Promise<boolean>
  onMoveToGallery: (ids: number[], distributorId: number, dateInGallery?: string) => Promise<boolean>
  onMarkPrinted?: (ids: number[]) => Promise<boolean>
  isSaving: boolean
}

export function EditionRowActions({
  edition,
  distributors,
  sizes,
  onMarkSold,
  onMarkSettled,
  onChangeSize,
  onMoveToGallery,
  onMarkPrinted,
  isSaving,
}: Props) {
  const [showSoldDialog, setShowSoldDialog] = useState(false)
  const [showSizeDialog, setShowSizeDialog] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)

  // Sold dialog state
  const [salePrice, setSalePrice] = useState(edition.retail_price?.toString() || '')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])

  // Size dialog state
  const [newSize, setNewSize] = useState<string>(edition.size || '')

  // Move dialog state
  const [moveToDistributorId, setMoveToDistributorId] = useState('')
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split('T')[0])

  const handleMarkSold = async () => {
    const price = parseFloat(salePrice)
    if (isNaN(price) || price <= 0) return
    const commission = edition.distributors?.commission_percentage ?? undefined
    const success = await onMarkSold(edition.id, price, saleDate, commission)
    if (success) {
      setShowSoldDialog(false)
    }
  }

  const handleChangeSize = async () => {
    if (!newSize) return
    const success = await onChangeSize([edition.id], newSize)
    if (success) {
      setShowSizeDialog(false)
    }
  }

  const handleMoveToGallery = async () => {
    if (!moveToDistributorId) return
    const success = await onMoveToGallery([edition.id], parseInt(moveToDistributorId), moveDate)
    if (success) {
      setShowMoveDialog(false)
      setMoveToDistributorId('')
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!edition.is_printed && onMarkPrinted && (
            <DropdownMenuItem onClick={() => onMarkPrinted([edition.id])}>
              Mark as Printed
            </DropdownMenuItem>
          )}
          {edition.is_printed && !edition.is_sold && (
            <DropdownMenuItem onClick={() => setShowSoldDialog(true)}>
              Mark as Sold
            </DropdownMenuItem>
          )}
          {edition.is_sold && !edition.is_settled && (
            <DropdownMenuItem onClick={() => onMarkSettled([edition.id])}>
              Mark as Settled
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowSizeDialog(true)}>
            Change Size
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowMoveDialog(true)}>
            Move to Gallery
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mark as Sold Dialog */}
      <Dialog open={showSoldDialog} onOpenChange={setShowSoldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Sold</DialogTitle>
            <DialogDescription>
              Record sale for {edition.edition_display_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sale Price (£)</Label>
              <Input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Date Sold</Label>
              <Input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>
            {edition.distributors?.commission_percentage && (
              <p className="text-sm text-muted-foreground">
                Commission: {edition.distributors.commission_percentage}%
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSoldDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkSold} disabled={isSaving || !salePrice}>
              {isSaving ? 'Saving...' : 'Mark as Sold'}
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
              Update size for {edition.edition_display_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Size</Label>
              <Select value={newSize} onValueChange={setNewSize}>
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
            <Button onClick={handleChangeSize} disabled={isSaving || !newSize}>
              {isSaving ? 'Saving...' : 'Update Size'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to Gallery Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Gallery</DialogTitle>
            <DialogDescription>
              Move {edition.edition_display_name} to a new location
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
            <Button onClick={handleMoveToGallery} disabled={isSaving || !moveToDistributorId}>
              {isSaving ? 'Moving...' : 'Move Edition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
