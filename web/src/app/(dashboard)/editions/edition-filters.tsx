'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

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
  }
  onFilterChange: (key: string, value: string) => void
  onClearFilters: () => void
}

export function EditionFilters({
  prints,
  distributors,
  currentFilters,
  onFilterChange,
  onClearFilters,
}: FilterProps) {
  const [searchValue, setSearchValue] = useState(currentFilters.search || '')

  // Debounce search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchValue !== currentFilters.search) {
        onFilterChange('search', searchValue)
      }
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <Input
            placeholder="Search editions..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Printed filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Printed Status
          </label>
          <Select
            value={currentFilters.printed || 'all'}
            onValueChange={(value) => onFilterChange('printed', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Printed</SelectItem>
              <SelectItem value="false">Not Printed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sold filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sold Status
          </label>
          <Select
            value={currentFilters.sold || 'all'}
            onValueChange={(value) => onFilterChange('sold', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Sold</SelectItem>
              <SelectItem value="false">Available</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear filters */}
        <div className="flex items-end">
          {hasFilters && (
            <Button variant="outline" onClick={onClearFilters} className="w-full">
              Clear Filters
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
