'use client'

import { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type FilterProps = {
  prints: { id: number; name: string }[]
  distributors: { id: number; name: string }[]
  currentFilters: {
    search?: string
    print?: string
    distributor?: string
    size?: string
    frame?: string
    printed?: string
    sold?: string
    includeLegacy?: string
  }
  onFilterChange: (key: string, value: string) => void
  onClearFilters: () => void
  legacyCount?: number
}

type ToggleOption = {
  value: string
  label: string
}

function ToggleButtonGroup({
  options,
  value,
  onChange,
  className,
}: {
  options: ToggleOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  // Internal state for instant visual feedback
  const [internalValue, setInternalValue] = useState(value)

  // Sync with external value when it changes (e.g., clear filters)
  useEffect(() => {
    setInternalValue(value)
  }, [value])

  const handleClick = (newValue: string) => {
    flushSync(() => setInternalValue(newValue))
    onChange(newValue)
  }

  return (
    <div className={cn('flex rounded-lg border border-gray-200 overflow-hidden', className)}>
      {options.map((option, index) => (
        <button
          key={option.value}
          onClick={() => handleClick(option.value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium transition-colors duration-75',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
            internalValue === option.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50',
            index > 0 && 'border-l border-gray-200'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const printedOptions: ToggleOption[] = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Printed' },
  { value: 'false', label: 'Not Printed' },
]

const soldOptions: ToggleOption[] = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Sold' },
  { value: 'false', label: 'Available' },
  { value: 'unpaid', label: 'Unpaid' },
]

export function EditionFilters({
  prints,
  distributors,
  currentFilters,
  onFilterChange,
  onClearFilters,
  legacyCount = 0,
}: FilterProps) {
  const [searchValue, setSearchValue] = useState(currentFilters.search || '')
  const [isSearching, setIsSearching] = useState(false)

  // Debounce search input
  useEffect(() => {
    if (searchValue !== currentFilters.search) {
      setIsSearching(true)
    }
    const timeoutId = setTimeout(() => {
      if (searchValue !== currentFilters.search) {
        onFilterChange('search', searchValue)
      }
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchValue, currentFilters.search, onFilterChange])

  // Sync search value when filters are cleared externally
  useEffect(() => {
    setSearchValue(currentFilters.search || '')
  }, [currentFilters.search])

  const hasFilters = Object.values(currentFilters).some((v) => v && v !== 'all' && v !== '')

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Quick toggle filters - Printed and Sold */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Printed:</span>
          <ToggleButtonGroup
            options={printedOptions}
            value={currentFilters.printed || 'all'}
            onChange={(value) => onFilterChange('printed', value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Sold:</span>
          <ToggleButtonGroup
            options={soldOptions}
            value={currentFilters.sold || 'all'}
            onChange={(value) => onFilterChange('sold', value)}
          />
        </div>
        {legacyCount > 0 && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={currentFilters.includeLegacy === 'true'}
              onChange={(e) => onFilterChange('includeLegacy', e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Show legacy items
              <span className="ml-1 text-xs text-amber-600">({legacyCount} hidden)</span>
            </span>
          </label>
        )}
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <Input
              placeholder="e.g. Bembridge 4"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className={cn(isSearching && 'pr-8')}
            />
            {isSearching && (
              <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>
        </div>

        {/* Artwork filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Artwork
          </label>
          <Select
            value={currentFilters.print || 'all'}
            onValueChange={(value) => onFilterChange('print', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All artworks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All artworks</SelectItem>
              {prints.map((print) => (
                <SelectItem key={print.id} value={print.id.toString()}>
                  {print.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <Select
            value={currentFilters.distributor || 'all'}
            onValueChange={(value) => onFilterChange('distributor', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {distributors.map((dist) => (
                <SelectItem key={dist.id} value={dist.id.toString()}>
                  {dist.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Size filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Size
          </label>
          <Select
            value={currentFilters.size || 'all'}
            onValueChange={(value) => onFilterChange('size', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All sizes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sizes</SelectItem>
              <SelectItem value="Small">Small</SelectItem>
              <SelectItem value="Large">Large</SelectItem>
              <SelectItem value="Extra Large">Extra Large</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Frame type filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Frame Type
          </label>
          <Select
            value={currentFilters.frame || 'all'}
            onValueChange={(value) => onFilterChange('frame', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All frames" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All frames</SelectItem>
              <SelectItem value="Framed">Framed</SelectItem>
              <SelectItem value="Tube only">Tube only</SelectItem>
              <SelectItem value="Mounted">Mounted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
