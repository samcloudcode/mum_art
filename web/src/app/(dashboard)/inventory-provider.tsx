'use client'

import { useEffect } from 'react'
import { useInventoryStore } from '@/lib/store/inventory-store'

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { initialize, isLoading, isReady, error, loadTimeMs } = useInventoryStore()

  useEffect(() => { initialize() }, [initialize])

  if (!isReady && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading inventory...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <p className="text-red-600">Failed to load inventory: {error}</p>
          <button
            onClick={initialize}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {children}
      {loadTimeMs && (
        <div className="fixed bottom-4 right-4 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded border border-border/50">
          Loaded in {loadTimeMs}ms
        </div>
      )}
    </>
  )
}
