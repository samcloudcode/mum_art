'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { formatPrice, calculateNetAmount } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EditionsTableWithFilters } from '@/components/editions/editions-table-with-filters'
import { galleryPreviewPreset, galleryUnsettledPreset } from '@/lib/editions-presets'

type PageProps = {
  params: Promise<{ id: string }>
}

export default function GalleryDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const distributorId = parseInt(id)
  const {
    distributors,
    allEditions,
    isReady,
    isSaving,
    markSettled,
  } = useInventory()
  const [error, setError] = useState<string | null>(null)

  const distributor = useMemo(
    () => distributors.find((d) => d.id === distributorId),
    [distributors, distributorId]
  )

  const editions = useMemo(
    () => allEditions.filter((e) => e.distributor_id === distributorId),
    [allEditions, distributorId]
  )

  const { inStock, sold, unsettled, stockValue, totalRevenue, unsettledAmount } = useMemo(() => {
    const inStockEditions = editions.filter((e) => e.is_printed && !e.is_sold)
    const soldEditions = editions.filter((e) => e.is_sold)
    const unsettledEditions = soldEditions.filter((e) => !e.is_settled)

    const stockValue = inStockEditions.reduce((sum, e) => sum + (e.retail_price || 0), 0)
    const totalRevenue = soldEditions.reduce((sum, e) => sum + (e.retail_price || 0), 0)
    const unsettledAmount = unsettledEditions.reduce((sum, e) => {
      const commission = e.commission_percentage ?? distributor?.commission_percentage
      return sum + calculateNetAmount(e.retail_price, commission)
    }, 0)

    return {
      inStock: inStockEditions,
      sold: soldEditions,
      unsettled: unsettledEditions,
      stockValue,
      totalRevenue,
      unsettledAmount,
    }
  }, [editions, distributor])

  const handleMarkAllAsPaid = async () => {
    setError(null)
    const ids = unsettled.map((e) => e.id)
    const success = await markSettled(ids)
    if (!success) {
      setError('Failed to mark sales as paid. Please try again.')
    }
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
        <span className="text-gray-900">{distributor.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{distributor.name}</h1>
          {distributor.commission_percentage !== null && (
            <p className="text-gray-600">{distributor.commission_percentage}% commission</p>
          )}
          {distributor.contact_number && (
            <p className="text-sm text-gray-500 mt-1">{distributor.contact_number}</p>
          )}
        </div>
        <div className="flex gap-2">
          {distributor.web_address && (
            <Button variant="outline" asChild>
              <a href={distributor.web_address} target="_blank" rel="noopener noreferrer">
                Visit Website
              </a>
            </Button>
          )}
          <Button asChild>
            <Link href={`/galleries/${id}/stock-check`}>Start Stock Check</Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href={`/galleries/${id}/stock`}>
          <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>In Stock</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{inStock.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500">Value: {formatPrice(stockValue)}</p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sold</CardDescription>
            <CardTitle className="text-3xl text-green-600">{sold.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">Revenue: {formatPrice(totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unsettled</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{unsettled.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">Amount due: {formatPrice(unsettledAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Commission Rate</CardDescription>
            <CardTitle className="text-3xl">{distributor.commission_percentage ?? 0}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              Net to artist: {100 - (distributor.commission_percentage ?? 0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current Stock Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Stock</CardTitle>
              <CardDescription>{inStock.length} editions available · Value: {formatPrice(stockValue)}</CardDescription>
            </div>
            <Button asChild>
              <Link href={`/galleries/${id}/stock`}>View Full Stock</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4">
          {inStock.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No stock at this location</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <EditionsTableWithFilters
                {...galleryPreviewPreset(distributorId)}
                showCard={false}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unsettled Sales */}
      {unsettled.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-amber-600">Unsettled Sales</CardTitle>
                <CardDescription>
                  {unsettled.length} sales pending payment · {formatPrice(unsettledAmount)} due
                </CardDescription>
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              </div>
              <Button onClick={handleMarkAllAsPaid} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Mark All as Paid'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4">
            <div className="overflow-x-auto -mx-4 px-4">
              <EditionsTableWithFilters
                {...galleryUnsettledPreset(distributorId)}
                showCard={false}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back button */}
      <Button variant="outline" asChild>
        <Link href="/galleries">Back to Galleries</Link>
      </Button>
    </div>
  )
}
