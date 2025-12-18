import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function GalleryDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch the distributor
  const { data: distributor, error: distError } = await supabase
    .from('distributors')
    .select('*')
    .eq('id', parseInt(id))
    .single()

  if (distError || !distributor) {
    notFound()
  }

  // Fetch all editions at this location with print info
  const { data: editions } = await supabase
    .from('editions')
    .select(`
      *,
      prints(id, name)
    `)
    .eq('distributor_id', parseInt(id))
    .order('is_sold', { ascending: true })
    .order('edition_display_name', { ascending: true })

  // Calculate stats
  const inStock = editions?.filter((e) => e.is_printed && !e.is_sold) || []
  const sold = editions?.filter((e) => e.is_sold) || []
  const unsettled = sold.filter((e) => !e.is_settled)

  const stockValue = inStock.reduce((sum, e) => sum + (e.retail_price || 0), 0)
  const totalRevenue = sold.reduce((sum, e) => sum + (e.retail_price || 0), 0)
  const unsettledAmount = unsettled.reduce((sum, e) => {
    const commission = e.commission_percentage || distributor.commission_percentage || 0
    return sum + (e.retail_price || 0) * (1 - commission / 100)
  }, 0)

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return `£${price.toLocaleString()}`
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-GB')
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
            <p className="text-gray-600">
              {distributor.commission_percentage}% commission
            </p>
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
          <Button>Start Stock Check</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Stock</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{inStock.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              Value: {formatPrice(stockValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sold</CardDescription>
            <CardTitle className="text-3xl text-green-600">{sold.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              Revenue: {formatPrice(totalRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unsettled</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{unsettled.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              Amount due: {formatPrice(unsettledAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Commission Rate</CardDescription>
            <CardTitle className="text-3xl">
              {distributor.commission_percentage ?? 0}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              Net to artist: {100 - (distributor.commission_percentage ?? 0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current Stock Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Stock</CardTitle>
              <CardDescription>{inStock.length} editions available</CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/editions?distributor=${distributor.id}&sold=false`}>
                View in Editions
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {inStock.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No stock at this location</p>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Edition</TableHead>
                    <TableHead>Artwork</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Frame</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>In Gallery Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inStock.map((edition) => (
                    <TableRow key={edition.id}>
                      <TableCell>
                        <Link
                          href={`/editions/${edition.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {edition.edition_display_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {edition.prints ? (
                          <Link
                            href={`/artworks/${edition.prints.id}`}
                            className="hover:underline"
                          >
                            {edition.prints.name}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {edition.size ? (
                          <Badge variant="outline">{edition.size}</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {edition.frame_type || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(edition.retail_price)}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {formatDate(edition.date_in_gallery)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unsettled Sales */}
      {unsettled.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Unsettled Sales</CardTitle>
                <CardDescription>
                  {unsettled.length} sales pending payment ({formatPrice(unsettledAmount)})
                </CardDescription>
              </div>
              <Button>Mark All as Paid</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Edition</TableHead>
                  <TableHead>Date Sold</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-right">Net Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unsettled.map((edition) => {
                  const commission = edition.commission_percentage || distributor.commission_percentage || 0
                  const netDue = (edition.retail_price || 0) * (1 - commission / 100)
                  return (
                    <TableRow key={edition.id}>
                      <TableCell>
                        <Link
                          href={`/editions/${edition.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {edition.edition_display_name}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(edition.date_sold)}</TableCell>
                      <TableCell className="text-right">
                        {formatPrice(edition.retail_price)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatPrice(netDue)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
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
