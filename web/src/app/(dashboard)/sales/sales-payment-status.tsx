'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { feedbackStyles } from '@/lib/utils/badge-styles'

type SalesPaymentStatusProps = {
  saleId: number
  isSettled: boolean
  onToggleSettled: (id: number, isSettled: boolean) => Promise<boolean>
  disabled?: boolean
}

export function SalesPaymentStatus({
  saleId,
  isSettled,
  onToggleSettled,
  disabled = false,
}: SalesPaymentStatusProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const handleChange = async (value: string) => {
    const newValue = value === 'paid'
    if (newValue === isSettled) return

    setIsSaving(true)
    const success = await onToggleSettled(saleId, newValue)
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
