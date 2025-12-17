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

export default async function ArtworkDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch the artwork
  const { data: print, error: printError } = await supabase
    .from('prints')
    .select('*')
    .eq('id', parseInt(id))
    .single()

  if (printError || !print) {
    notFound()
  }

  // Fetch all editions for this artwork with distributor info
  const { data: editions } = await supabase
    .from('editions')
    .select(`
      *,
      distributors(id, name, commission_percentage)
    `)
    .eq('print_id', parseInt(id))
    .order('edition_number', { ascending: true })

  // Calculate stats
  const total = editions?.length || 0
  const printed = editions?.filter((e) => e.is_printed).length || 0
  const sold = editions?.filter((e) => e.is_sold).length || 0
  const settled = editions?.filter((e) => e.is_settled).length || 0
  const available = total - sold
  const stats = { total, printed, sold, settled, available }

  // Calculate revenue
  const totalRevenue = editions
    ?.filter((e) => e.is_sold && e.retail_price)
    .reduce((sum, e) => sum + (e.retail_price || 0), 0) || 0

  const unsettledRevenue = editions
    ?.filter((e) => e.is_sold && !e.is_settled && e.retail_price)
    .reduce((sum, e) => {
      const commission = e.commission_percentage || 0
      return sum + (e.retail_price || 0) * (1 - commission / 100)
    }, 0) || 0

  // Group by location
  const locationGroups = new Map<string, { count: number; sold: number }>()
  editions?.forEach((e) => {
    const loc = e.distributors?.name || 'Unassigned'
    const current = locationGroups.get(loc) || { count: 0, sold: 0 }
    current.count++
    if (e.is_sold) current.sold++
    locationGroups.set(loc, current)
  })

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return `£${price.toLocaleString()}`
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/artworks" className="hover:text-gray-900">
          Artworks
        </Link>
        <span>/</span>
        <span className="text-gray-900">{print.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{print.name}</h1>
          {print.description && (
            <p className="text-gray-600 mt-1">{print.description}</p>
          )}
          {print.total_editions && (
            <p className="text-sm text-gray-500 mt-1">
              Limited edition of {print.total_editions}
            </p>
          )}
        </div>
        {print.web_link && (
          <Button variant="outline" asChild>
            <a href={print.web_link} target="_blank" rel="noopener noreferrer">
              View Online
            </a>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Editions</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              {stats.printed} printed, {stats.total - stats.printed} unprinted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sold</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.sold}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              {stats.total > 0 ? Math.round((stats.sold / stats.total) * 100) : 0}% sell-through
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-3xl">{formatPrice(totalRevenue)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">From {stats.sold} sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unsettled</CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {formatPrice(unsettledRevenue)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              {stats.sold - stats.settled} sales pending payment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Location breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Stock by Location</CardTitle>
          <CardDescription>Where editions are currently located</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from(locationGroups.entries()).map(([location, data]) => {
              const available = data.count - data.sold
              return (
                <div key={location} className="flex items-center justify-between">
                  <span className="font-medium">{location}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      {available} available / {data.count} total
                    </span>
                    {available > 0 && (
                      <Badge className="bg-blue-100 text-blue-800">{available} in stock</Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Editions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Editions</CardTitle>
              <CardDescription>{editions?.length || 0} editions</CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/editions?print=${print.id}`}>View in Editions</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Edition</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Frame</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editions?.map((edition) => (
                  <TableRow key={edition.id}>
                    <TableCell>
                      <Link
                        href={`/editions/${edition.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        #{edition.edition_number}
                      </Link>
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
                    <TableCell>
                      {edition.distributors?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(edition.retail_price)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {edition.is_sold ? (
                          <Badge className="bg-green-100 text-green-800">Sold</Badge>
                        ) : edition.is_printed ? (
                          <Badge className="bg-blue-100 text-blue-800">Printed</Badge>
                        ) : (
                          <Badge variant="secondary">Not Printed</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Back button */}
      <Button variant="outline" asChild>
        <Link href="/artworks">Back to Artworks</Link>
      </Button>
    </div>
  )
}
