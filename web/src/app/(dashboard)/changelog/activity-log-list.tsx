'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ActivityLog } from '@/lib/types'

type Props = {
  activities: ActivityLog[]
  totalCount: number
  uniqueUsers: string[]
  currentSearch?: string
  currentAction?: string
  currentUser?: string
}

const actionLabels: Record<string, { label: string; color: string }> = {
  update: { label: 'Updated', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  create: { label: 'Created', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  delete: { label: 'Deleted', color: 'text-red-600 bg-red-500/10 border-red-500/20' },
  move: { label: 'Moved', color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
  sell: { label: 'Sold', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  settle: { label: 'Settled', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
}

export function ActivityLogList({
  activities,
  totalCount,
  uniqueUsers,
  currentSearch,
  currentAction,
  currentUser,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(currentSearch || '')

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

    startTransition(() => {
      router.push(`/changelog?${params.toString()}`)
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ q: search || undefined })
  }

  const clearFilters = () => {
    setSearch('')
    startTransition(() => {
      router.push('/changelog')
    })
  }

  const hasFilters = currentSearch || currentAction || currentUser

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  return (
    <div className="space-y-6">
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search changes..."
              className="w-full px-4 py-2.5 pr-10 bg-card border border-border rounded-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        </form>

        <div className="flex gap-3">
          <select
            value={currentAction || ''}
            onChange={(e) => updateFilters({ action: e.target.value || undefined })}
            className="px-3 py-2 bg-card border border-border rounded-sm text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All actions</option>
            <option value="update">Updates</option>
            <option value="create">Creates</option>
            <option value="delete">Deletes</option>
            <option value="move">Moves</option>
            <option value="sell">Sales</option>
            <option value="settle">Settlements</option>
          </select>

          {uniqueUsers.length > 0 && (
            <select
              value={currentUser || ''}
              onChange={(e) => updateFilters({ user: e.target.value || undefined })}
              className="px-3 py-2 bg-card border border-border rounded-sm text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All users</option>
              {uniqueUsers.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
            </select>
          )}

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {isPending ? (
          <span>Loading...</span>
        ) : (
          <span>
            {totalCount} {totalCount === 1 ? 'change' : 'changes'}
            {hasFilters && ' matching filters'}
          </span>
        )}
      </div>

      {/* Activity list */}
      {activities.length === 0 ? (
        <div className="gallery-plaque text-center py-12">
          <p className="text-muted-foreground">
            {hasFilters ? 'No changes match your filters' : 'No activity recorded yet'}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {hasFilters
              ? 'Try adjusting your search or filters'
              : 'Changes will appear here when users edit editions, mark sales, etc.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => {
            const actionStyle = actionLabels[activity.action] || {
              label: activity.action,
              color: 'text-muted-foreground bg-muted border-border',
            }

            return (
              <div key={activity.id} className="gallery-plaque p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${actionStyle.color}`}
                      >
                        {actionStyle.label}
                      </span>
                      <span className="text-sm text-muted-foreground">{activity.entity_type}</span>
                      {activity.entity_name && (
                        <span className="text-sm font-medium text-foreground truncate">
                          {activity.entity_name}
                        </span>
                      )}
                    </div>

                    {activity.description && (
                      <p className="text-sm text-foreground mt-1.5">{activity.description}</p>
                    )}

                    {activity.field_name && (activity.old_value || activity.new_value) && (
                      <div className="text-sm text-muted-foreground mt-1.5">
                        <span className="font-medium">{activity.field_name}:</span>{' '}
                        {activity.old_value && (
                          <span className="line-through text-red-600/70">{activity.old_value}</span>
                        )}
                        {activity.old_value && activity.new_value && ' → '}
                        {activity.new_value && (
                          <span className="text-emerald-600">{activity.new_value}</span>
                        )}
                      </div>
                    )}

                    {activity.related_entity_name && (
                      <div className="text-sm text-muted-foreground mt-1">
                        → {activity.related_entity_type}: {activity.related_entity_name}
                      </div>
                    )}
                  </div>

                  <div className="text-right text-sm shrink-0">
                    <p className="text-foreground">{formatTimeAgo(activity.created_at)}</p>
                    {activity.user_email && (
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {activity.user_email.split('@')[0]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
