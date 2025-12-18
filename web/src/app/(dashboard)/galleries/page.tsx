import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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
    .select('distributor_id, is_sold, is_settled, is_printed, retail_price, commission_percentage')

  // Calculate stats per distributor
  const statsMap = new Map<number, {
    total: number
    sold: number
    inStock: number
    unsettledCount: number
    unsettledAmount: number
    stockValue: number
  }>()

  editionStats?.forEach((edition) => {
    if (!edition.distributor_id) return
    const current = statsMap.get(edition.distributor_id) || {
      total: 0,
      sold: 0,
      inStock: 0,
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
    } else if (edition.is_printed) {
      // In stock = printed but not sold
      current.inStock++
      if (edition.retail_price) {
        current.stockValue += edition.retail_price
      }
    }
    statsMap.set(edition.distributor_id, current)
  })

  const formatPrice = (price: number) => `£${price.toLocaleString()}`

  return (
    <div className="space-y-10">
      {/* Page header */}
      <header className="border-b border-border pb-8">
        <h1 className="text-foreground mb-2">Gallery Network</h1>
        <p className="text-muted-foreground text-lg font-light">
          {distributors?.length || 0} locations displaying your work
        </p>
      </header>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-sm p-4">
          <p className="text-destructive">Error loading galleries: {error.message}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {distributors?.map((dist, index) => {
            const stats = statsMap.get(dist.id) || {
              total: 0,
              sold: 0,
              inStock: 0,
              unsettledCount: 0,
              unsettledAmount: 0,
              stockValue: 0,
            }
            const staggerClass = `stagger-${(index % 4) + 1}`

            return (
              <Link
                key={dist.id}
                href={`/galleries/${dist.id}`}
                className={`group gallery-plaque hover:border-accent/30 transition-all duration-300 animate-fade-up opacity-0 ${staggerClass}`}
              >
                {/* Header with name and status */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-serif text-lg text-foreground group-hover:text-accent transition-colors">
                      {dist.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {dist.commission_percentage !== null
                        ? `${dist.commission_percentage}% commission`
                        : 'Direct sales'}
                    </p>
                  </div>
                  {stats.unsettledAmount > 0 && (
                    <span className="text-xs px-2 py-1 bg-accent/10 text-accent rounded-sm font-medium">
                      {formatPrice(stats.unsettledAmount)} due
                    </span>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div>
                    <p className="stat-value-sm text-foreground/70">{stats.inStock}</p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                      In Stock
                    </p>
                  </div>
                  <div>
                    <p className="stat-value-sm status-sold">{stats.sold}</p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                      Sold
                    </p>
                  </div>
                  <div>
                    <p className="stat-value-sm text-foreground">{stats.total}</p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                      Total
                    </p>
                  </div>
                </div>

                {/* Stock value */}
                {stats.stockValue > 0 && (
                  <div className="pt-4 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        Stock value
                      </span>
                      <span className="font-mono text-sm text-foreground">
                        {formatPrice(stats.stockValue)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Contact info */}
                {dist.contact_number && (
                  <p className="text-xs text-muted-foreground mt-3 truncate">
                    {dist.contact_number}
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
