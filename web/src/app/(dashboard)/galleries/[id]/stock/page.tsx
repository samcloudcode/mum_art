'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { formatPrice } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EditionsTableWithFilters } from '@/components/editions/editions-table-with-filters'
import { AddEditionsToGalleryDialog } from '@/components/add-editions-to-gallery-dialog'
import { galleryStockPreset } from '@/lib/editions-presets'
import { ArrowLeft } from 'lucide-react'

type PageProps = {
  params: Promise<{ id: string }>
}

export default function GalleryStockPage({ params }: PageProps) {
  const { id } = use(params)
  const distributorId = parseInt(id)
  const { distributors, allEditions, isReady } = useInventory()
  const [stockValue, setStockValue] = useState(0)

  const distributor = useMemo(
    () => distributors.find((d) => d.id === distributorId),
    [distributors, distributorId]
  )

  // Get total in-stock count for header
  const inStockCount = useMemo(
    () =>
      allEditions.filter(
        (e) => e.distributor_id === distributorId && e.is_printed && !e.is_sold
      ).length,
    [allEditions, distributorId]
  )

  // Get total stock value for header
  const totalStockValue = useMemo(
    () =>
      allEditions
        .filter((e) => e.distributor_id === distributorId && e.is_printed && !e.is_sold)
        .reduce((sum, e) => sum + (e.retail_price || 0), 0),
    [allEditions, distributorId]
  )

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
              {inStockCount} editions in stock • Total value: {formatPrice(totalStockValue)}
            </p>
          </div>
        </div>
        <AddEditionsToGalleryDialog
          distributorId={distributorId}
          distributorName={distributor.name}
        />
      </div>

      {/* Stock Table with Filters */}
      <EditionsTableWithFilters
        {...galleryStockPreset(distributorId)}
        showResultsSummary
        onStockValueChange={setStockValue}
        enableMobileView
        hideLocationInCards
      />

      {/* Back button */}
      <Button variant="outline" asChild>
        <Link href={`/galleries/${id}`}>Back to Gallery</Link>
      </Button>
    </div>
  )
}
