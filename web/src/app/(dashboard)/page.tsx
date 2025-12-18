import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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
  const printedEditions = editions?.filter((e) => e.is_printed).length || 0
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
    if (e.is_printed && !e.is_sold) current.inStock++
    if (e.is_sold && !e.is_settled) current.unsettled++
    galleryStats.set(e.distributor_id, current)
  })

  const formatPrice = (price: number) => `£${price.toLocaleString()}`
  const sellThrough = totalEditions > 0 ? Math.round((soldEditions.length / totalEditions) * 100) : 0

  return (
    <div className="space-y-12">
      {/* Page header - gallery exhibition style */}
      <header className="border-b border-border pb-8">
        <h1 className="text-foreground mb-2">Collection Overview</h1>
        <p className="text-muted-foreground text-lg font-light">
          {totalEditions.toLocaleString()} editions across your portfolio
        </p>
      </header>

      {/* Key metrics - exhibition plaque style */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Editions */}
        <div className="gallery-plaque animate-fade-up opacity-0 stagger-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Total Editions
          </p>
          <p className="stat-value text-foreground">
            {totalEditions.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {printedEditions.toLocaleString()} printed
          </p>
        </div>

        {/* Sold */}
        <div className="gallery-plaque animate-fade-up opacity-0 stagger-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Sold
          </p>
          <p className="stat-value status-sold">
            {soldEditions.length.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {sellThrough}% sell-through
          </p>
        </div>

        {/* Revenue */}
        <div className="gallery-plaque animate-fade-up opacity-0 stagger-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Total Revenue
          </p>
          <p className="stat-value text-foreground">
            {formatPrice(totalRevenue)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            from {soldEditions.length} sales
          </p>
        </div>

        {/* Unsettled */}
        <div className="gallery-plaque animate-fade-up opacity-0 stagger-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Awaiting Payment
          </p>
          <p className="stat-value status-pending">
            {formatPrice(unsettledAmount)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {unsettledEditions.length} sales pending
          </p>
        </div>
      </section>

      {/* Quick Actions - refined card style */}
      <section>
        <h2 className="text-foreground mb-6">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/editions?printed=false"
            className="group exhibition-label hover:border-l-accent transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground group-hover:text-accent transition-colors">
                  Record Printing
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Mark editions as printed
                </p>
              </div>
              <svg
                className="w-5 h-5 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-1 transition-all"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>

          <Link
            href="/editions?sold=false&printed=true"
            className="group exhibition-label hover:border-l-accent transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground group-hover:text-accent transition-colors">
                  Move Stock
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Transfer editions to galleries
                </p>
              </div>
              <svg
                className="w-5 h-5 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-1 transition-all"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>

          <Link
            href="/sales"
            className="group exhibition-label hover:border-l-accent transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground group-hover:text-accent transition-colors">
                  View Sales
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Track payments by month
                </p>
              </div>
              <svg
                className="w-5 h-5 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-1 transition-all"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
        </div>
      </section>

      {/* Gallery Overview - refined list */}
      <section>
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-foreground">Gallery Locations</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Stock and outstanding payments by location
            </p>
          </div>
          <Link
            href="/galleries"
            className="text-sm text-muted-foreground hover:text-accent gallery-link transition-colors"
          >
            View all galleries
          </Link>
        </div>

        <div className="border border-border rounded-sm overflow-hidden">
          {distributors?.slice(0, 6).map((dist, index) => {
            const stats = galleryStats.get(dist.id) || { inStock: 0, unsettled: 0 }
            const isLast = index === Math.min(5, (distributors?.length || 0) - 1)

            return (
              <Link
                key={dist.id}
                href={`/galleries/${dist.id}`}
                className={`flex items-center justify-between p-4 hover:bg-muted/30 transition-colors ${
                  !isLast ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-sm bg-muted flex items-center justify-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      {dist.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{dist.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {stats.inStock} in stock
                      {dist.commission_percentage !== null && (
                        <span className="text-muted-foreground/60">
                          {' '}&middot; {dist.commission_percentage}% commission
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {stats.unsettled > 0 && (
                  <span className="text-sm status-pending font-medium px-3 py-1 bg-accent/10 rounded-sm">
                    {stats.unsettled} unsettled
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
