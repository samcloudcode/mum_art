import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function GalleriesPage() {
  const supabase = await createClient()

  // Fetch distributors
  const { data: distributors, error } = await supabase
    .from('distributors')
    .select('*')
    .order('name')

  // Fetch edition counts per distributor
  const { data: editionStats } = await supabase
    .from('editions')
    .select('distributor_id, is_sold, is_settled, retail_price, commission_percentage')

  // Calculate stats per distributor
  const statsMap = new Map<number, {
    total: number
    sold: number
    unsettledCount: number
    unsettledAmount: number
    stockValue: number
  }>()

  editionStats?.forEach((edition) => {
    if (!edition.distributor_id) return
    const current = statsMap.get(edition.distributor_id) || {
      total: 0,
      sold: 0,
      unsettledCount: 0,
      unsettledAmount: 0,
      stockValue: 0,
    }
    current.total++
    if (edition.is_sold) {
      current.sold++
      if (!edition.is_settled && edition.retail_price) {
        current.unsettledCount++
        const commission = edition.commission_percentage || 0
        current.unsettledAmount += edition.retail_price * (1 - commission / 100)
      }
    } else if (edition.retail_price) {
      current.stockValue += edition.retail_price
    }
    statsMap.set(edition.distributor_id, current)
  })

  const formatPrice = (price: number) => `£${price.toLocaleString()}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Galleries & Locations</h1>
          <p className="text-sm text-gray-600">
            {distributors?.length || 0} locations
          </p>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">Error loading galleries: {error.message}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {distributors?.map((dist) => {
            const stats = statsMap.get(dist.id) || {
              total: 0,
              sold: 0,
              unsettledCount: 0,
              unsettledAmount: 0,
              stockValue: 0,
            }
            const inStock = stats.total - stats.sold

            return (
              <Link key={dist.id} href={`/galleries/${dist.id}`}>
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{dist.name}</CardTitle>
                        <CardDescription>
                          {dist.commission_percentage !== null
                            ? `${dist.commission_percentage}% commission`
                            : 'No commission rate set'}
                        </CardDescription>
                      </div>
                      {stats.unsettledAmount > 0 && (
                        <Badge className="bg-amber-100 text-amber-800">
                          {formatPrice(stats.unsettledAmount)} due
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-2xl font-bold text-blue-600">{inStock}</p>
                          <p className="text-xs text-gray-500">In Stock</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">{stats.sold}</p>
                          <p className="text-xs text-gray-500">Sold</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                          <p className="text-xs text-gray-500">Total</p>
                        </div>
                      </div>

                      {/* Stock value */}
                      {stats.stockValue > 0 && (
                        <div className="text-center pt-2 border-t">
                          <p className="text-sm text-gray-600">
                            Stock value: <span className="font-medium">{formatPrice(stats.stockValue)}</span>
                          </p>
                        </div>
                      )}

                      {/* Contact info */}
                      {dist.contact_number && (
                        <p className="text-xs text-gray-500 truncate">
                          {dist.contact_number}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
