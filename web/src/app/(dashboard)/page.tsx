import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch editions with stats
  const { data: editions } = await supabase
    .from('editions')
    .select('is_sold, is_settled, is_printed, retail_price, commission_percentage, distributor_id')

  // Fetch distributors for the gallery overview
  const { data: distributors } = await supabase
    .from('distributors')
    .select('id, name, commission_percentage')
    .order('name')

  // Calculate stats
  const totalEditions = editions?.length || 0
  const soldEditions = editions?.filter((e) => e.is_sold) || []
  const unsettledEditions = soldEditions.filter((e) => !e.is_settled)

  const totalRevenue = soldEditions.reduce((sum, e) => sum + (e.retail_price || 0), 0)
  const unsettledAmount = unsettledEditions.reduce((sum, e) => {
    const commission = e.commission_percentage || 0
    return sum + (e.retail_price || 0) * (1 - commission / 100)
  }, 0)

  // Calculate gallery stats
  const galleryStats = new Map<number, { inStock: number; unsettled: number }>()
  editions?.forEach((e) => {
    if (!e.distributor_id) return
    const current = galleryStats.get(e.distributor_id) || { inStock: 0, unsettled: 0 }
    if (!e.is_sold) current.inStock++
    if (e.is_sold && !e.is_settled) current.unsettled++
    galleryStats.set(e.distributor_id, current)
  })

  const formatPrice = (price: number) => `£${price.toLocaleString()}`
  const sellThrough = totalEditions > 0 ? Math.round((soldEditions.length / totalEditions) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600">Overview of your art print inventory</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Editions</CardDescription>
            <CardTitle className="text-3xl">{totalEditions.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              {editions?.filter((e) => e.is_printed).length.toLocaleString()} printed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sold</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {soldEditions.length.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">{sellThrough}% sell-through</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-3xl">{formatPrice(totalRevenue)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">From {soldEditions.length} sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unsettled</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{formatPrice(unsettledAmount)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">{unsettledEditions.length} sales pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/editions?printed=false">
          <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-lg font-medium">Record Printing</p>
                <p className="text-sm text-gray-500">Mark editions as printed</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/editions?sold=false&printed=true">
          <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-lg font-medium">Move Stock</p>
                <p className="text-sm text-gray-500">Transfer editions to galleries</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sales">
          <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-lg font-medium">View Sales</p>
                <p className="text-sm text-gray-500">Track payments by month</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Gallery Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gallery Overview</CardTitle>
            <CardDescription>Stock and outstanding payments by location</CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link href="/galleries">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {distributors?.slice(0, 6).map((dist) => {
              const stats = galleryStats.get(dist.id) || { inStock: 0, unsettled: 0 }
              return (
                <Link
                  key={dist.id}
                  href={`/galleries/${dist.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium">{dist.name}</p>
                    <p className="text-sm text-gray-500">
                      {stats.inStock} in stock
                      {dist.commission_percentage !== null && ` | ${dist.commission_percentage}%`}
                    </p>
                  </div>
                  {stats.unsettled > 0 && (
                    <span className="text-sm text-amber-600 font-medium">
                      {stats.unsettled} unsettled
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
