import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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
    <div className="space-y-10">
      {/* Page header */}
      <header className="border-b border-border pb-8">
        <h1 className="text-foreground mb-2">Artwork Collection</h1>
        <p className="text-muted-foreground text-lg font-light">
          {prints?.length || 0} original designs in your portfolio
        </p>
      </header>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-sm p-4">
          <p className="text-destructive">Error loading artworks: {error.message}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {prints?.map((print, index) => {
            const stats = statsMap.get(print.id) || { total: 0, printed: 0, sold: 0 }
            const available = stats.total - stats.sold
            const sellThrough = stats.total > 0 ? Math.round((stats.sold / stats.total) * 100) : 0
            const staggerClass = `stagger-${(index % 4) + 1}`

            return (
              <Link
                key={print.id}
                href={`/artworks/${print.id}`}
                className={`group gallery-plaque hover:border-accent/30 transition-all duration-300 animate-fade-up opacity-0 ${staggerClass}`}
              >
                {/* Artwork title */}
                <h3 className="font-serif text-lg text-foreground group-hover:text-accent transition-colors mb-1">
                  {print.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-5">
                  {print.total_editions ? `Edition of ${print.total_editions}` : 'Open edition'}
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div>
                    <p className="stat-value-sm text-foreground">{stats.total}</p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                      Editions
                    </p>
                  </div>
                  <div>
                    <p className="stat-value-sm status-sold">{stats.sold}</p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                      Sold
                    </p>
                  </div>
                  <div>
                    <p className="stat-value-sm text-foreground/70">{available}</p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                      Available
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span className="uppercase tracking-wider">Sell-through</span>
                    <span className="font-mono">{sellThrough}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-seafoam rounded-sm transition-all duration-500"
                      style={{ width: `${sellThrough}%` }}
                    />
                  </div>
                </div>

                {/* Status indicators */}
                <div className="flex gap-2 flex-wrap">
                  {stats.printed < stats.total && (
                    <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-sm">
                      {stats.total - stats.printed} unprinted
                    </span>
                  )}
                  {available > 0 && (
                    <span className="text-xs px-2 py-1 bg-accent/10 text-accent rounded-sm">
                      {available} in stock
                    </span>
                  )}
                  {sellThrough >= 90 && (
                    <span className="text-xs px-2 py-1 bg-gold/20 text-gold rounded-sm">
                      Nearly sold out
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
