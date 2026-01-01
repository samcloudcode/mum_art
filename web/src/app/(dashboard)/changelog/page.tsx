import { createClient } from '@/lib/supabase/server'
import { ActivityLogList } from './activity-log-list'

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; user?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Build query for activity log
  let query = supabase
    .from('activity_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100)

  // Apply search filter
  if (params.q) {
    query = query.or(
      `entity_name.ilike.%${params.q}%,description.ilike.%${params.q}%,new_value.ilike.%${params.q}%,old_value.ilike.%${params.q}%`
    )
  }

  // Apply action filter
  if (params.action) {
    query = query.eq('action', params.action)
  }

  // Apply user filter
  if (params.user) {
    query = query.ilike('user_email', `%${params.user}%`)
  }

  const { data: activities, error, count } = await query

  // Get unique users for filter dropdown
  const { data: users } = await supabase
    .from('activity_log')
    .select('user_email')
    .not('user_email', 'is', null)
    .order('user_email')

  const uniqueUsers = [...new Set(users?.map((u) => u.user_email).filter(Boolean))] as string[]

  // Get action counts for stats
  const { data: actionCounts } = await supabase.rpc('get_activity_action_counts').maybeSingle()

  return (
    <div className="space-y-10">
      {/* Page header */}
      <header className="border-b border-border pb-8">
        <h1 className="text-foreground mb-2">Activity Log</h1>
        <p className="text-muted-foreground text-lg font-light">
          Track changes made by users across the system
        </p>
      </header>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-sm p-4">
          <p className="text-destructive">Error loading activity: {error.message}</p>
        </div>
      ) : (
        <ActivityLogList
          activities={activities || []}
          totalCount={count || 0}
          uniqueUsers={uniqueUsers}
          currentSearch={params.q}
          currentAction={params.action}
          currentUser={params.user}
        />
      )}
    </div>
  )
}
