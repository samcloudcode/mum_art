import { createClient } from '@/lib/supabase/server'
import { EditionsTable } from './editions-table'
import { EditionFilters } from './edition-filters'

type SearchParams = Promise<{
  search?: string
  print?: string
  distributor?: string
  size?: string
  frame?: string
  printed?: string
  sold?: string
  page?: string
}>

export default async function EditionsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const supabase = await createClient()

  const page = parseInt(params.page || '1')
  const pageSize = 50
  const offset = (page - 1) * pageSize

  // Build the query
  let query = supabase
    .from('editions')
    .select(`
      *,
      prints!inner(id, name),
      distributors(id, name, commission_percentage)
    `, { count: 'exact' })
    .order('id', { ascending: true })
    .range(offset, offset + pageSize - 1)

  // Apply filters
  if (params.search) {
    query = query.ilike('edition_display_name', `%${params.search}%`)
  }
  if (params.print) {
    query = query.eq('print_id', parseInt(params.print))
  }
  if (params.distributor) {
    query = query.eq('distributor_id', parseInt(params.distributor))
  }
  if (params.size && params.size !== 'all') {
    query = query.eq('size', params.size)
  }
  if (params.frame && params.frame !== 'all') {
    query = query.eq('frame_type', params.frame)
  }
  if (params.printed === 'true') {
    query = query.eq('is_printed', true)
  } else if (params.printed === 'false') {
    query = query.eq('is_printed', false)
  }
  if (params.sold === 'true') {
    query = query.eq('is_sold', true)
  } else if (params.sold === 'false') {
    query = query.eq('is_sold', false)
  }

  const { data: editions, count, error } = await query

  // Fetch filter options
  const { data: prints } = await supabase
    .from('prints')
    .select('id, name')
    .order('name')

  const { data: distributors } = await supabase
    .from('distributors')
    .select('id, name, commission_percentage')
    .order('name')

  const totalPages = Math.ceil((count || 0) / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editions</h1>
          <p className="text-sm text-gray-600">
            {count?.toLocaleString() || 0} editions total
          </p>
        </div>
      </div>

      <EditionFilters
        prints={prints || []}
        distributors={distributors || []}
        currentFilters={params}
      />

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">Error loading editions: {error.message}</p>
        </div>
      ) : (
        <EditionsTable
          editions={editions || []}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          total={count || 0}
          distributors={distributors || []}
        />
      )}
    </div>
  )
}
