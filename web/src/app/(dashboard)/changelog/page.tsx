import { createClient } from '@/lib/supabase/server'

export default async function ChangelogPage() {
  const supabase = await createClient()

  const { data: logs, error } = await supabase
    .from('sync_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(100)

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress...'
    const ms = new Date(end).getTime() - new Date(start).getTime()
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  }

  const getStatusStyle = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
      case 'failed':
        return 'bg-red-500/10 text-red-600 border-red-500/20'
      case 'running':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      case 'rolled_back':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const totalRecords = logs?.reduce((sum, log) => sum + (log.records_processed || 0), 0) || 0
  const successfulImports = logs?.filter(log => log.status === 'completed').length || 0
  const failedImports = logs?.filter(log => log.status === 'failed').length || 0

  return (
    <div className="space-y-10">
      {/* Page header */}
      <header className="border-b border-border pb-8">
        <h1 className="text-foreground mb-2">Import History</h1>
        <p className="text-muted-foreground text-lg font-light">
          Sync operations and data import audit trail
        </p>
      </header>

      {/* Summary stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="gallery-plaque animate-fade-up opacity-0 stagger-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Total Imports
          </p>
          <p className="stat-value text-foreground">{logs?.length || 0}</p>
        </div>
        <div className="gallery-plaque animate-fade-up opacity-0 stagger-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Successful
          </p>
          <p className="stat-value text-emerald-600">{successfulImports}</p>
        </div>
        <div className="gallery-plaque animate-fade-up opacity-0 stagger-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Failed
          </p>
          <p className="stat-value text-red-600">{failedImports}</p>
        </div>
        <div className="gallery-plaque animate-fade-up opacity-0 stagger-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Records Processed
          </p>
          <p className="stat-value text-foreground">{totalRecords.toLocaleString()}</p>
        </div>
      </section>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-sm p-4">
          <p className="text-destructive">Error loading logs: {error.message}</p>
        </div>
      ) : !logs || logs.length === 0 ? (
        <div className="gallery-plaque text-center py-12">
          <p className="text-muted-foreground">No import history found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Run an import to see sync logs here
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">Recent Imports</h2>
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="gallery-plaque p-5 space-y-4"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${getStatusStyle(log.status)}`}>
                        {log.status || 'unknown'}
                      </span>
                      {log.sync_type && (
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          {log.sync_type}
                        </span>
                      )}
                      {log.table_name && (
                        <span className="text-xs text-muted-foreground">
                          → {log.table_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      ID: {log.sync_id}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-foreground">
                      {new Date(log.started_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(log.started_at).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' · '}
                      {formatDuration(log.started_at, log.completed_at)}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-5 gap-4 text-center border-t border-border pt-4">
                  <div>
                    <p className="text-lg font-medium text-foreground">
                      {log.records_processed || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Processed</p>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-emerald-600">
                      {log.records_created || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Created</p>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-blue-600">
                      {log.records_updated || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Updated</p>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-amber-600">
                      {log.records_deleted || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Deleted</p>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-red-600">
                      {log.records_failed || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>

                {/* Source file */}
                {log.source_file && (
                  <div className="text-xs text-muted-foreground border-t border-border pt-3">
                    <span className="font-medium">Source:</span> {log.source_file}
                  </div>
                )}

                {/* Error message */}
                {log.error_message && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded p-3 text-sm text-red-600">
                    {log.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
