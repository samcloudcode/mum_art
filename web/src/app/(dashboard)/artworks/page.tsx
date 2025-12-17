import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function ArtworksPage() {
  const supabase = await createClient()

  // Fetch prints with edition statistics
  const { data: prints, error } = await supabase
    .from('prints')
    .select('*')
    .order('name')

  // Fetch edition counts per print
  const { data: editionStats } = await supabase
    .from('editions')
    .select('print_id, is_printed, is_sold')

  // Calculate stats per print
  const statsMap = new Map<number, { total: number; printed: number; sold: number }>()
  editionStats?.forEach((edition) => {
    const current = statsMap.get(edition.print_id) || { total: 0, printed: 0, sold: 0 }
    current.total++
    if (edition.is_printed) current.printed++
    if (edition.is_sold) current.sold++
    statsMap.set(edition.print_id, current)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Artworks</h1>
          <p className="text-sm text-gray-600">
            {prints?.length || 0} artwork designs
          </p>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">Error loading artworks: {error.message}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {prints?.map((print) => {
            const stats = statsMap.get(print.id) || { total: 0, printed: 0, sold: 0 }
            const available = stats.total - stats.sold
            const sellThrough = stats.total > 0 ? Math.round((stats.sold / stats.total) * 100) : 0

            return (
              <Link key={print.id} href={`/artworks/${print.id}`}>
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{print.name}</CardTitle>
                    <CardDescription>
                      {print.total_editions ? `${print.total_editions} edition run` : 'No edition count'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                          <p className="text-xs text-gray-500">Editions</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">{stats.sold}</p>
                          <p className="text-xs text-gray-500">Sold</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-600">{available}</p>
                          <p className="text-xs text-gray-500">Available</p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Sell-through</span>
                          <span>{sellThrough}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${sellThrough}%` }}
                          />
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex gap-1 flex-wrap">
                        {stats.printed < stats.total && (
                          <Badge variant="outline" className="text-xs">
                            {stats.total - stats.printed} unprinted
                          </Badge>
                        )}
                        {available > 0 && (
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            {available} in stock
                          </Badge>
                        )}
                        {sellThrough >= 90 && (
                          <Badge className="bg-amber-100 text-amber-800 text-xs">
                            Nearly sold out
                          </Badge>
                        )}
                      </div>
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
