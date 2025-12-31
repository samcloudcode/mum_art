'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { formatPrice } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EditionsDataTable } from '@/components/editions/editions-data-table'
import { ArrowLeft, Search, X } from 'lucide-react'

type PageProps = {
  params: Promise<{ id: string }>
}

export default function GalleryStockPage({ params }: PageProps) {
  const { id } = use(params)
  const {
    distributors,
    allEditions,
    sizes,
    isReady,
    isSaving,
    update,
    updateMany,
    markSold,
    markSettled,
    markPrinted,
    moveToGallery,
  } = useInventory()

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [sizeFilter, setSizeFilter] = useState<string>('all')
  const [frameFilter, setFrameFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')

  const distributor = useMemo(
    () => distributors.find((d) => d.id === parseInt(id)),
    [distributors, id]
  )

  // Get all in-stock editions for this gallery
  const inStockEditions = useMemo(
    () =>
      allEditions.filter(
        (e) => e.distributor_id === parseInt(id) && e.is_printed && !e.is_sold
      ),
    [allEditions, id]
  )

  // Apply filters and sorting
  const filteredEditions = useMemo(() => {
    let result = [...inStockEditions]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (e) =>
          e.edition_display_name.toLowerCase().includes(term) ||
          e.prints?.name.toLowerCase().includes(term)
      )
    }

    // Size filter
    if (sizeFilter !== 'all') {
      result = result.filter((e) => e.size === sizeFilter)
    }

    // Frame filter
    if (frameFilter !== 'all') {
      result = result.filter((e) => e.frame_type === frameFilter)
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.edition_display_name.localeCompare(b.edition_display_name)
        case 'artwork':
          return (a.prints?.name || '').localeCompare(b.prints?.name || '')
        case 'price-high':
          return (b.retail_price || 0) - (a.retail_price || 0)
        case 'price-low':
          return (a.retail_price || 0) - (b.retail_price || 0)
        case 'size':
          return (a.size || '').localeCompare(b.size || '')
        default:
          return 0
      }
    })

    return result
  }, [inStockEditions, searchTerm, sizeFilter, frameFilter, sortBy])

  // Get unique values for filters
  const availableSizes = useMemo(() => {
    const sizeSet = new Set(inStockEditions.map((e) => e.size).filter(Boolean))
    return Array.from(sizeSet).sort()
  }, [inStockEditions])

  const availableFrameTypes = useMemo(() => {
    const frameSet = new Set(inStockEditions.map((e) => e.frame_type).filter(Boolean))
    return Array.from(frameSet).sort()
  }, [inStockEditions])

  // Stock value calculation
  const stockValue = useMemo(
    () => filteredEditions.reduce((sum, e) => sum + (e.retail_price || 0), 0),
    [filteredEditions]
  )

  const hasActiveFilters = searchTerm || sizeFilter !== 'all' || frameFilter !== 'all'

  const clearFilters = () => {
    setSearchTerm('')
    setSizeFilter('all')
    setFrameFilter('all')
  }

  if (!isReady) return null

  if (!distributor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/galleries" className="hover:text-gray-900">
            Galleries
          </Link>
          <span>/</span>
          <span className="text-gray-900">Not Found</span>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Gallery not found</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/galleries">Back to Galleries</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/galleries" className="hover:text-gray-900">
          Galleries
        </Link>
        <span>/</span>
        <Link href={`/galleries/${id}`} className="hover:text-gray-900">
          {distributor.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900">Stock</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/galleries/${id}`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {distributor.name} — Current Stock
              </h1>
              <p className="text-gray-600">
                {inStockEditions.length} editions in stock • Total value: {formatPrice(inStockEditions.reduce((sum, e) => sum + (e.retail_price || 0), 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search editions or artworks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Size filter */}
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {availableSizes.map((size) => (
                  <SelectItem key={size} value={size!}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Frame filter */}
            <Select value={frameFilter} onValueChange={setFrameFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Frame" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Frames</SelectItem>
                {availableFrameTypes.map((frame) => (
                  <SelectItem key={frame} value={frame!}>
                    {frame}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Edition Name</SelectItem>
                <SelectItem value="artwork">Artwork</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="size">Size</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results summary */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <span className="text-sm text-blue-700">
            Showing {filteredEditions.length} of {inStockEditions.length} editions
            {filteredEditions.length > 0 && (
              <> • Filtered value: {formatPrice(stockValue)}</>
            )}
          </span>
        </div>
      )}

      {/* Stock Table */}
      <Card>
        <CardContent className="pt-6">
          {filteredEditions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {hasActiveFilters
                  ? 'No editions match your filters'
                  : 'No stock at this location'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <EditionsDataTable
              editions={filteredEditions}
              distributors={distributors}
              sizes={sizes}
              showSelection={true}
              showPagination={true}
              showExpandableRows={true}
              enableInlineEdit={true}
              pageSize={25}
              columns={['edition', 'artwork', 'size', 'frame', 'price', 'printed', 'sale', 'actions']}
              onUpdate={update}
              onBulkUpdate={updateMany}
              onMarkSold={markSold}
              onMarkSettled={markSettled}
              onMoveToGallery={moveToGallery}
              onMarkPrinted={markPrinted}
              isSaving={isSaving}
            />
          )}
        </CardContent>
      </Card>

      {/* Back button */}
      <Button variant="outline" asChild>
        <Link href={`/galleries/${id}`}>Back to Gallery</Link>
      </Button>
    </div>
  )
}
