'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { formatPrice, calculateNetAmount } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { editionStatusStyles } from '@/lib/utils/badge-styles'
import { EditionsTableWithFilters } from '@/components/editions/editions-table-with-filters'
import { artworkEditionsPreset } from '@/lib/editions-presets'
import { ArtworkImageSection } from '@/components/artwork-image-section'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'

type PageProps = {
  params: Promise<{ id: string }>
}

type TimeGrouping = 'month' | 'quarter' | 'year'

export default function ArtworkDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const [timeGrouping, setTimeGrouping] = useState<TimeGrouping>('month')
  const { prints, allEditions, isReady } = useInventory()

  const print = useMemo(() => prints.find((p) => p.id === parseInt(id)), [prints, id])

  const editions = useMemo(
    () =>
      allEditions
        .filter((e) => e.print_id === parseInt(id))
        .sort((a, b) => (a.edition_number || 0) - (b.edition_number || 0)),
    [allEditions, id]
  )

  // Calculate stats
  const stats = useMemo(() => {
    const total = editions.length
    const printed = editions.filter((e) => e.is_printed).length
    const sold = editions.filter((e) => e.is_sold).length
    const settled = editions.filter((e) => e.is_settled).length
    const inStock = editions.filter((e) => e.is_printed && !e.is_sold).length
    const remaining = total - sold // Total unsold editions
    return { total, printed, sold, settled, inStock, remaining }
  }, [editions])

  // Calculate revenue
  const { totalRevenue, unsettledRevenue } = useMemo(() => {
    const totalRevenue = editions
      .filter((e) => e.is_sold && e.retail_price)
      .reduce((sum, e) => sum + (e.retail_price || 0), 0)

    const unsettledRevenue = editions
      .filter((e) => e.is_sold && !e.is_settled && e.retail_price)
      .reduce((sum, e) => sum + calculateNetAmount(e.retail_price, e.commission_percentage), 0)

    return { totalRevenue, unsettledRevenue }
  }, [editions])

  // Get unsettled editions with location info
  const unsettledEditions = useMemo(() => {
    return editions
      .filter((e) => e.is_sold && !e.is_settled)
      .map((e) => ({
        id: e.id,
        name: e.edition_display_name,
        location: e.distributors?.name || 'Direct',
        size: e.size,
        price: e.retail_price,
        commission: e.commission_percentage,
        netAmount: calculateNetAmount(e.retail_price, e.commission_percentage),
        dateSold: e.date_sold,
      }))
  }, [editions])

  // Group by location with printed stock and sales info
  const locationGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        total: number
        sold: number
        printedStock: number
        sizes: Map<string, number>
      }
    >()
    editions.forEach((e) => {
      const loc = e.distributors?.name || 'Unassigned'
      const current = groups.get(loc) || {
        total: 0,
        sold: 0,
        printedStock: 0,
        sizes: new Map(),
      }
      current.total++
      if (e.is_sold) current.sold++
      if (e.is_printed && !e.is_sold) {
        current.printedStock++
        // Track sizes for printed stock
        const size = e.size || 'Unknown'
        current.sizes.set(size, (current.sizes.get(size) || 0) + 1)
      }
      groups.set(loc, current)
    })
    return groups
  }, [editions])

  // Sales by gallery chart data
  const salesByGalleryData = useMemo(() => {
    const gallerySales = new Map<string, number>()
    editions
      .filter((e) => e.is_sold)
      .forEach((e) => {
        const loc = e.distributors?.name || 'Direct'
        gallerySales.set(loc, (gallerySales.get(loc) || 0) + 1)
      })
    return Array.from(gallerySales.entries())
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
  }, [editions])

  // Sales over time chart data
  const salesOverTimeData = useMemo(() => {
    const soldEditions = editions.filter((e) => e.is_sold && e.date_sold)

    if (soldEditions.length === 0) return []

    const groupedSales = new Map<string, number>()

    soldEditions.forEach((e) => {
      const date = new Date(e.date_sold!)
      let key: string

      switch (timeGrouping) {
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        case 'quarter':
          const quarter = Math.ceil((date.getMonth() + 1) / 3)
          key = `${date.getFullYear()} Q${quarter}`
          break
        case 'year':
          key = `${date.getFullYear()}`
          break
      }

      groupedSales.set(key, (groupedSales.get(key) || 0) + 1)
    })

    return Array.from(groupedSales.entries())
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period))
  }, [editions, timeGrouping])

  // Colors for charts
  const chartColors = [
    'hsl(var(--accent))',
    'hsl(var(--seafoam))',
    'hsl(var(--gold))',
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
  ]

  if (!isReady) return null

  if (!print) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/artworks" className="hover:text-gray-900">
            Artworks
          </Link>
          <span>/</span>
          <span className="text-gray-900">Not Found</span>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Artwork not found</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/artworks">Back to Artworks</Link>
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
        <Link href="/artworks" className="hover:text-gray-900">
          Artworks
        </Link>
        <span>/</span>
        <span className="text-gray-900">{print.name}</span>
      </div>

      {/* Header with Image */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Image Section */}
        <div className="md:w-1/3">
          <ArtworkImageSection
            printId={print.id}
            printName={print.name}
            initialImagePath={print.primary_image_path}
          />
        </div>

        {/* Details Section */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{print.name}</h1>
            {print.description && <p className="text-gray-600 mt-1">{print.description}</p>}
            {print.total_editions && (
              <p className="text-sm text-gray-500 mt-1">
                Limited edition of {print.total_editions}
              </p>
            )}
          </div>
          {print.web_link && (
            <div className="mt-4">
              <Button variant="outline" asChild>
                <a href={print.web_link} target="_blank" rel="noopener noreferrer">
                  View Online
                </a>
              </Button>
            </div>
          )}
        </div>
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
            <CardDescription>Remaining</CardDescription>
            <CardTitle className="text-3xl">{stats.remaining}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              {stats.inStock} in stock, {stats.remaining - stats.inStock} unprinted
            </p>
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

      {/* Unsettled Prints Section */}
      {unsettledEditions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-amber-600">Unsettled Sales</CardTitle>
            <CardDescription>
              {unsettledEditions.length} editions sold but not yet paid
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unsettledEditions.map((edition) => (
                <div
                  key={edition.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{edition.name}</span>
                    <Badge variant="outline">{edition.location}</Badge>
                    {edition.size && (
                      <span className="text-sm text-gray-500">{edition.size}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {edition.dateSold && (
                      <span className="text-sm text-gray-500">
                        {new Date(edition.dateSold).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                    <span className="font-medium text-amber-600">
                      {formatPrice(edition.netAmount)} net
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location breakdown - Updated with printed stock and sales */}
      <Card>
        <CardHeader>
          <CardTitle>Stock by Location</CardTitle>
          <CardDescription>Printed stock and sales by gallery</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from(locationGroups.entries()).map(([location, data]) => {
              const sizeSummary = Array.from(data.sizes.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([size, count]) => `${size}: ${count}`)
                .join(', ')

              return (
                <div key={location} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{location}</span>
                    <div className="flex items-center gap-3">
                      {data.printedStock > 0 && (
                        <Badge className={editionStatusStyles.printed.badge}>
                          {data.printedStock} in stock
                        </Badge>
                      )}
                      {data.sold > 0 && (
                        <Badge className={editionStatusStyles.sold.badge}>{data.sold} sold</Badge>
                      )}
                    </div>
                  </div>
                  {data.printedStock > 0 && sizeSummary && (
                    <p className="text-xs text-gray-500 mt-1">Sizes: {sizeSummary}</p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales by Gallery Chart */}
        {salesByGalleryData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sales by Gallery</CardTitle>
              <CardDescription>Top performing locations for this artwork</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByGalleryData} layout="vertical">
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) =>
                        value.length > 15 ? `${value.substring(0, 15)}...` : value
                      }
                    />
                    <Tooltip
                      formatter={(value) => [`${value} sold`, 'Sales']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="sales" radius={[0, 4, 4, 0]}>
                      {salesByGalleryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sales Over Time Chart */}
        {salesOverTimeData.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sales Over Time</CardTitle>
                  <CardDescription>Sales trend for this artwork</CardDescription>
                </div>
                <div className="flex gap-1">
                  {(['month', 'quarter', 'year'] as TimeGrouping[]).map((grouping) => (
                    <Button
                      key={grouping}
                      size="sm"
                      variant={timeGrouping === grouping ? 'default' : 'outline'}
                      onClick={() => setTimeGrouping(grouping)}
                      className="text-xs px-2 py-1 h-7"
                    >
                      {grouping.charAt(0).toUpperCase() + grouping.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesOverTimeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [`${value} sold`, 'Sales']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--accent))', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Editions Table */}
      <EditionsTableWithFilters
        {...artworkEditionsPreset(print.id)}
        title="All Editions"
        description={`${editions.length} editions`}
        headerActions={
          <Button variant="outline" asChild>
            <Link href={`/editions?print=${print.id}`}>View in Editions</Link>
          </Button>
        }
        maxHeight="500px"
      />

      {/* Back button */}
      <Button variant="outline" asChild>
        <Link href="/artworks">Back to Artworks</Link>
      </Button>
    </div>
  )
}
