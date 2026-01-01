'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Loader2, Check } from 'lucide-react'
import type { EditionWithRelations } from '@/lib/types'
import { cn } from '@/lib/utils'
import { feedbackStyles } from '@/lib/utils/badge-styles'

// =============================================================================
// Payment Status Select - Simple "Unpaid" / "Paid" toggle for sales page
// =============================================================================

type PaymentStatusProps = {
  saleId: number
  isSettled: boolean
  onToggle: (id: number, isSettled: boolean) => Promise<boolean>
  disabled?: boolean
}

export function PaymentStatusSelect({
  saleId,
  isSettled,
  onToggle,
  disabled = false,
}: PaymentStatusProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const handleChange = async (value: string) => {
    const newValue = value === 'paid'
    if (newValue === isSettled) return

    setIsSaving(true)
    const success = await onToggle(saleId, newValue)
    setIsSaving(false)

    if (success) {
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 600)
    }
  }

  return (
    <div className={cn(
      'relative rounded transition-colors duration-300',
      justSaved && feedbackStyles.saved
    )}>
      <Select
        value={isSettled ? 'paid' : 'unpaid'}
        onValueChange={handleChange}
        disabled={disabled || isSaving}
      >
        <SelectTrigger
          className={cn(
            'h-7 text-sm w-[80px]',
            'border-transparent bg-transparent shadow-none',
            'hover:border-gray-300 hover:bg-gray-50',
            'focus:border-gray-300 focus:bg-white focus:ring-0',
            'data-[state=open]:border-gray-300 data-[state=open]:bg-white',
            '[&>svg]:opacity-0 hover:[&>svg]:opacity-50 data-[state=open]:[&>svg]:opacity-100',
            'transition-all duration-200'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unpaid">Unpaid</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
        </SelectContent>
      </Select>
      {isSaving && (
        <Loader2 className="absolute right-8 top-1.5 h-4 w-4 animate-spin text-gray-400" />
      )}
    </div>
  )
}

// =============================================================================
// Print Status Select - "Not Printed" / "Printed"
// =============================================================================

type PrintStatusProps = {
  edition: EditionWithRelations
  onUpdate: (id: number, isPrinted: boolean) => Promise<boolean>
  disabled?: boolean
}

export function PrintStatusSelect({
  edition,
  onUpdate,
  disabled = false,
}: PrintStatusProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const handleChange = async (value: string) => {
    const newValue = value === 'printed'
    if (newValue === edition.is_printed) return

    setIsSaving(true)
    const success = await onUpdate(edition.id, newValue)
    setIsSaving(false)
    if (success) {
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 600)
    }
  }

  const isPrinted = edition.is_printed

  return (
    <div className={cn(
      'relative rounded transition-colors duration-300',
      justSaved && feedbackStyles.saved
    )}>
      <Select
        value={isPrinted ? 'printed' : 'not_printed'}
        onValueChange={handleChange}
        disabled={disabled || isSaving}
      >
        <SelectTrigger
          className={cn(
            'h-auto py-1 px-3 text-xs font-medium rounded-full cursor-pointer',
            'border shadow-sm focus:ring-0 focus:ring-offset-0',
            isPrinted
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
              : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100 hover:border-stone-300',
            '[&>svg]:hidden',
            'transition-all duration-150'
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="not_printed">Not Printed</SelectItem>
          <SelectItem value="printed">Printed</SelectItem>
        </SelectContent>
      </Select>
      {isSaving && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-gray-400" />
      )}
    </div>
  )
}

// =============================================================================
// Sale Status Select - "Unsold" / "Sold" / "Settled"
// With popover for entering sale details when marking as sold
// =============================================================================

type SaleStatusProps = {
  edition: EditionWithRelations
  onMarkSold: (id: number, price: number, date: string, commissionPercentage?: number) => Promise<boolean>
  onMarkUnsold: (id: number) => Promise<boolean>
  onMarkSettled: (id: number, isSettled: boolean) => Promise<boolean>
  disabled?: boolean
}

export function SaleStatusSelect({
  edition,
  onMarkSold,
  onMarkUnsold,
  onMarkSettled,
  disabled = false,
}: SaleStatusProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [showSoldPopover, setShowSoldPopover] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  // Form state for marking as sold
  const [salePrice, setSalePrice] = useState(edition.retail_price?.toString() || '')
  const [saleDate, setSaleDate] = useState(
    edition.date_sold || new Date().toISOString().split('T')[0]
  )

  const currentStatus = edition.is_sold
    ? (edition.is_settled ? 'settled' : 'sold')
    : 'unsold'

  const handleChange = async (value: string) => {
    // Special case: "edit" opens the popover for editing sale details
    if (value === 'edit') {
      setSalePrice(edition.retail_price?.toString() || '')
      setSaleDate(edition.date_sold || new Date().toISOString().split('T')[0])
      setShowSoldPopover(true)
      return
    }

    if (value === currentStatus) return

    // If changing TO sold from unsold, show popover for details
    if (value === 'sold' && currentStatus === 'unsold') {
      setPendingStatus('sold')
      setSalePrice(edition.retail_price?.toString() || '')
      setSaleDate(new Date().toISOString().split('T')[0])
      setShowSoldPopover(true)
      return
    }

    setIsSaving(true)
    let success = false

    if (value === 'unsold') {
      // Marking as unsold (clearing sale)
      success = await onMarkUnsold(edition.id)
    } else if (value === 'sold' && currentStatus === 'settled') {
      // Settled -> Sold (mark as unsettled)
      success = await onMarkSettled(edition.id, false)
    } else if (value === 'settled') {
      // Sold -> Settled
      success = await onMarkSettled(edition.id, true)
    }

    setIsSaving(false)
    if (success) {
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 600)
    }
  }

  const handleSoldSubmit = async () => {
    const price = salePrice === '' ? 0 : parseFloat(salePrice)
    if (isNaN(price) || price < 0) return

    setIsSaving(true)
    const commission = edition.distributors?.commission_percentage ?? undefined
    const success = await onMarkSold(edition.id, price, saleDate, commission)
    setIsSaving(false)

    if (success) {
      setShowSoldPopover(false)
      setPendingStatus(null)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 600)
    }
  }

  const handlePopoverClose = () => {
    setShowSoldPopover(false)
    setPendingStatus(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSoldSubmit()
    }
  }

  const displayStatus = pendingStatus || currentStatus

  // Badge colors based on status
  const statusStyles = {
    unsold: 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100 hover:border-stone-300',
    sold: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300',
    settled: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300',
  }

  return (
    <Popover open={showSoldPopover} onOpenChange={setShowSoldPopover}>
      <div className={cn(
        'relative rounded transition-colors duration-300',
        justSaved && feedbackStyles.saved
      )}>
        <PopoverTrigger asChild>
          <div>
            <Select
              value={displayStatus}
              onValueChange={handleChange}
              disabled={disabled || isSaving}
            >
              <SelectTrigger
                className={cn(
                  'h-auto py-1 px-3 text-xs font-medium rounded-full cursor-pointer',
                  'border shadow-sm focus:ring-0 focus:ring-offset-0',
                  statusStyles[displayStatus as keyof typeof statusStyles],
                  '[&>svg]:hidden',
                  'transition-all duration-150'
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unsold">Unsold</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
                {edition.is_sold && (
                  <>
                    <div className="h-px bg-gray-200 my-1" />
                    <SelectItem value="edit" className="text-muted-foreground">
                      Edit sale...
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </PopoverTrigger>
        {isSaving && !showSoldPopover && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-gray-400" />
        )}
      </div>
      <PopoverContent className="w-56 p-3" align="start" onClick={(e) => e.stopPropagation()} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Sale Details</h4>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sale Price (£)</Label>
              <Input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0"
                className="h-8"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date Sold</Label>
              <Input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8"
              />
            </div>
            {edition.distributors?.commission_percentage != null && (
              <p className="text-xs text-muted-foreground">
                Commission: {edition.distributors.commission_percentage}%
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePopoverClose}
                className="flex-1 h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSoldSubmit}
                disabled={isSaving}
                className="flex-1 h-7 text-xs"
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
    </Popover>
  )
}
