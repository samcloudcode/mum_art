'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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

type CellType = 'text' | 'number' | 'select' | 'checkbox'

type BaseProps = {
  editionId: number
  field: string
  disabled?: boolean
  className?: string
}

type TextCellProps = BaseProps & {
  type: 'text'
  value: string | null
  onSave: (id: number, field: string, value: string | null) => Promise<boolean>
}

type NumberCellProps = BaseProps & {
  type: 'number'
  value: number | null
  prefix?: string
  onSave: (id: number, field: string, value: number | null) => Promise<boolean>
}

type SelectCellProps = BaseProps & {
  type: 'select'
  value: string | number | null
  options: { value: string | number; label: string }[]
  placeholder?: string
  onSave: (id: number, field: string, value: string | number | null) => Promise<boolean>
}

type CheckboxCellProps = BaseProps & {
  type: 'checkbox'
  value: boolean
  onSave: (id: number, field: string, value: boolean) => Promise<boolean>
}

type InlineCellProps = TextCellProps | NumberCellProps | SelectCellProps | CheckboxCellProps

export function EditionInlineCell(props: InlineCellProps) {
  const { type, editionId, field, disabled, className } = props

  switch (type) {
    case 'text':
      return <TextCell {...props} />
    case 'number':
      return <NumberCell {...props} />
    case 'select':
      return <SelectCell {...props} />
    case 'checkbox':
      return <CheckboxCell {...props} />
  }
}

function TextCell({ editionId, field, value, onSave, disabled, className }: TextCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = useCallback(async () => {
    if (editValue === (value || '')) {
      setIsEditing(false)
      return
    }
    setIsSaving(true)
    const success = await onSave(editionId, field, editValue || null)
    setIsSaving(false)
    if (success) {
      setIsEditing(false)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 600)
    }
  }, [editValue, value, onSave, editionId, field])

  const handleCancel = useCallback(() => {
    setEditValue(value || '')
    setIsEditing(false)
  }, [value])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }, [handleSave, handleCancel])

  if (disabled) {
    return <span className={className}>{value || '-'}</span>
  }

  if (isEditing) {
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={cn('h-7 text-sm', className)}
        />
        {isSaving && (
          <Loader2 className="absolute right-2 top-1.5 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>
    )
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={cn(
        'cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded -mx-1 transition-colors duration-300',
        justSaved && feedbackStyles.saved,
        className
      )}
    >
      {value || '-'}
    </span>
  )
}

function NumberCell({ editionId, field, value, prefix, onSave, disabled, className }: NumberCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value?.toString() || '')
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = useCallback(async () => {
    const numValue = editValue ? parseFloat(editValue) : null
    if (numValue === value) {
      setIsEditing(false)
      return
    }
    setIsSaving(true)
    const success = await onSave(editionId, field, numValue)
    setIsSaving(false)
    if (success) {
      setIsEditing(false)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 600)
    }
  }, [editValue, value, onSave, editionId, field])

  const handleCancel = useCallback(() => {
    setEditValue(value?.toString() || '')
    setIsEditing(false)
  }, [value])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }, [handleSave, handleCancel])

  const formatValue = () => {
    if (value === null) return '-'
    const formatted = value.toLocaleString()
    return prefix ? `${prefix}${formatted}` : formatted
  }

  if (disabled) {
    return <span className={className}>{formatValue()}</span>
  }

  if (isEditing) {
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={cn('h-7 text-sm', className)}
        />
        {isSaving && (
          <Loader2 className="absolute right-2 top-1.5 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>
    )
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={cn(
        'cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded -mx-1 transition-colors duration-300',
        justSaved && feedbackStyles.saved,
        className
      )}
    >
      {formatValue()}
    </span>
  )
}

function SelectCell({
  editionId,
  field,
  value,
  options,
  placeholder,
  onSave,
  disabled,
  className
}: SelectCellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const handleChange = async (newValue: string) => {
    // Handle 'none' value as null
    const valueToSave = newValue === '__none__' ? null : (
      typeof value === 'number' ? parseInt(newValue) : newValue
    )

    if (valueToSave === value) {
      setIsOpen(false)
      return
    }

    setIsSaving(true)
    const success = await onSave(editionId, field, valueToSave)
    setIsSaving(false)
    if (success) {
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 600)
    }
    setIsOpen(false)
  }

  const currentLabel = options.find(o => String(o.value) === String(value))?.label

  if (disabled) {
    return <span className={className}>{currentLabel || '-'}</span>
  }

  return (
    <div className={cn(
      'relative rounded transition-colors duration-300',
      justSaved && 'bg-green-100'
    )}>
      <Select
        open={isOpen}
        onOpenChange={setIsOpen}
        value={value !== null ? String(value) : '__none__'}
        onValueChange={handleChange}
        disabled={isSaving}
      >
        <SelectTrigger
          className={cn(
            'h-7 text-sm w-full min-w-[100px]',
            'border-transparent bg-transparent shadow-none',
            'hover:border-gray-300 hover:bg-gray-50',
            'focus:border-gray-300 focus:bg-white focus:ring-0',
            'data-[state=open]:border-gray-300 data-[state=open]:bg-white',
            '[&>svg]:opacity-0 hover:[&>svg]:opacity-50 data-[state=open]:[&>svg]:opacity-100',
            'transition-all duration-200',
            className
          )}
        >
          <SelectValue placeholder={placeholder || '-'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">-</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isSaving && (
        <Loader2 className="absolute right-8 top-1.5 h-4 w-4 animate-spin text-gray-400" />
      )}
    </div>
  )
}

function CheckboxCell({ editionId, field, value, onSave, disabled, className }: CheckboxCellProps) {
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = async (checked: boolean) => {
    if (checked === value) return
    setIsSaving(true)
    await onSave(editionId, field, checked)
    setIsSaving(false)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Checkbox
        checked={value}
        onCheckedChange={handleChange}
        disabled={disabled || isSaving}
      />
      {isSaving && (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      )}
    </div>
  )
}
