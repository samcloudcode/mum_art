'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

type Edition = {
  id: number
  edition_display_name: string
  edition_number: number | null
  size: string | null
  frame_type: string | null
  retail_price: number | null
  is_printed: boolean | null
  is_sold: boolean | null
  is_settled: boolean | null
  date_sold: string | null
  date_in_gallery: string | null
  commission_percentage: number | null
  notes: string | null
  payment_note: string | null
  distributor_id: number | null
  print_id: number
  prints: { id: number; name: string; total_editions: number | null } | null
  distributors: { id: number; name: string; commission_percentage: number | null } | null
}

type Distributor = {
  id: number
  name: string
  commission_percentage: number | null
}

type Props = {
  edition: Edition
  distributors: Distributor[]
}

export function EditionDetail({ edition, distributors }: Props) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [size, setSize] = useState(edition.size || '')
  const [frameType, setFrameType] = useState(edition.frame_type || '')
  const [retailPrice, setRetailPrice] = useState(edition.retail_price?.toString() || '')
  const [distributorId, setDistributorId] = useState(edition.distributor_id?.toString() || '')
  const [isPrinted, setIsPrinted] = useState(edition.is_printed || false)
  const [notes, setNotes] = useState(edition.notes || '')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('editions')
        .update({
          size: size || null,
          frame_type: frameType || null,
          retail_price: retailPrice ? parseFloat(retailPrice) : null,
          distributor_id: distributorId ? parseInt(distributorId) : null,
          is_printed: isPrinted,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', edition.id)

      if (updateError) throw updateError

      setIsEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setSize(edition.size || '')
    setFrameType(edition.frame_type || '')
    setRetailPrice(edition.retail_price?.toString() || '')
    setDistributorId(edition.distributor_id?.toString() || '')
    setIsPrinted(edition.is_printed || false)
    setNotes(edition.notes || '')
    setIsEditing(false)
    setError(null)
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return `£${price.toLocaleString()}`
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-GB')
  }

  // Calculate net revenue if sold
  const calculateNetRevenue = () => {
    if (!edition.is_sold || !edition.retail_price) return null
    const commission = edition.commission_percentage || 0
    return edition.retail_price * (1 - commission / 100)
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/editions" className="hover:text-gray-900">
          Editions
        </Link>
        <span>/</span>
        <span className="text-gray-900">{edition.edition_display_name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {edition.edition_display_name}
          </h1>
          {edition.prints && (
            <p className="text-gray-600">
              <Link href={`/artworks/${edition.prints.id}`} className="hover:underline">
                {edition.prints.name}
              </Link>
              {edition.prints.total_editions && (
                <span className="text-gray-400">
                  {' '}
                  (edition {edition.edition_number} of {edition.prints.total_editions})
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {edition.is_sold ? (
            <Badge className="bg-green-100 text-green-800">Sold</Badge>
          ) : edition.is_printed ? (
            <Badge className="bg-blue-100 text-blue-800">Printed</Badge>
          ) : (
            <Badge variant="secondary">Not Printed</Badge>
          )}
          {edition.is_sold && !edition.is_settled && (
            <Badge className="bg-amber-100 text-amber-800">Unpaid</Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Details Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Edition Details</CardTitle>
              <CardDescription>Physical attributes and pricing</CardDescription>
            </div>
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Size</Label>
                    <Select value={size} onValueChange={setSize}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Small">Small</SelectItem>
                        <SelectItem value="Large">Large</SelectItem>
                        <SelectItem value="Extra Large">Extra Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Frame Type</Label>
                    <Select value={frameType} onValueChange={setFrameType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frame type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Framed">Framed</SelectItem>
                        <SelectItem value="Tube only">Tube only</SelectItem>
                        <SelectItem value="Mounted">Mounted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Retail Price (£)</Label>
                  <Input
                    type="number"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select value={distributorId} onValueChange={setDistributorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {distributors.map((dist) => (
                        <SelectItem key={dist.id} value={dist.id.toString()}>
                          {dist.name}
                          {dist.commission_percentage !== null &&
                            ` (${dist.commission_percentage}%)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_printed"
                    checked={isPrinted}
                    onCheckedChange={(checked) => setIsPrinted(checked === true)}
                  />
                  <Label htmlFor="is_printed">Printed</Label>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes..."
                  />
                </div>
              </>
            ) : (
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Size</dt>
                  <dd className="font-medium">{edition.size || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Frame Type</dt>
                  <dd className="font-medium">{edition.frame_type || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Retail Price</dt>
                  <dd className="font-medium">{formatPrice(edition.retail_price)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Location</dt>
                  <dd className="font-medium">
                    {edition.distributors ? (
                      <Link
                        href={`/galleries/${edition.distributors.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {edition.distributors.name}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Printed</dt>
                  <dd className="font-medium">{edition.is_printed ? 'Yes' : 'No'}</dd>
                </div>
                {edition.notes && (
                  <div>
                    <dt className="text-gray-600 mb-1">Notes</dt>
                    <dd className="text-sm bg-gray-50 p-2 rounded">{edition.notes}</dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Sales Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Information</CardTitle>
            <CardDescription>
              {edition.is_sold ? 'This edition has been sold' : 'This edition is available'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {edition.is_sold ? (
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Date Sold</dt>
                  <dd className="font-medium">{formatDate(edition.date_sold)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Sale Price</dt>
                  <dd className="font-medium">{formatPrice(edition.retail_price)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Commission</dt>
                  <dd className="font-medium">
                    {edition.commission_percentage !== null
                      ? `${edition.commission_percentage}%`
                      : '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Net Revenue</dt>
                  <dd className="font-medium text-green-600">
                    {formatPrice(calculateNetRevenue())}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Payment Status</dt>
                  <dd>
                    {edition.is_settled ? (
                      <Badge className="bg-green-100 text-green-800">Paid</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800">Unpaid</Badge>
                    )}
                  </dd>
                </div>
                {edition.payment_note && (
                  <div>
                    <dt className="text-gray-600 mb-1">Payment Notes</dt>
                    <dd className="text-sm bg-gray-50 p-2 rounded">{edition.payment_note}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">This edition has not been sold yet</p>
                <Button>Record Sale</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gallery Card */}
        <Card>
          <CardHeader>
            <CardTitle>Gallery Information</CardTitle>
            <CardDescription>Current location and gallery history</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-gray-600">Current Location</dt>
                <dd className="font-medium">
                  {edition.distributors?.name || 'Not assigned'}
                </dd>
              </div>
              {edition.distributors?.commission_percentage !== null && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">Commission Rate</dt>
                  <dd className="font-medium">
                    {edition.distributors?.commission_percentage}%
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-600">Date in Gallery</dt>
                <dd className="font-medium">{formatDate(edition.date_in_gallery)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button variant="outline" asChild>
          <Link href="/editions">Back to Editions</Link>
        </Button>
      </div>
    </>
  )
}
