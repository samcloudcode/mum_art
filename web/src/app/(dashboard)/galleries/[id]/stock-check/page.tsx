'use client'

import { use, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react'
import type { EditionWithRelations } from '@/lib/types'

type PageProps = {
  params: Promise<{ id: string }>
}

type ArtworkGroup = {
  printId: number
  printName: string
  editions: EditionWithRelations[]
  checkedCount: number
  flaggedCount: number
}

export default function StockCheckPage({ params }: PageProps) {
  const { id } = use(params)
  const distributorId = parseInt(id)
  const {
    distributors,
    allEditions,
    isReady,
    isSaving,
    markStockChecked,
    markNeedsReview,
    resetStockCheckForGallery,
  } = useInventory()

  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const [isResetting, setIsResetting] = useState(false)

  const distributor = useMemo(
    () => distributors.find((d) => d.id === distributorId),
    [distributors, distributorId]
  )

  // Get in-stock editions for this gallery
  const stockEditions = useMemo(
    () =>
      allEditions.filter(
        (e) => e.distributor_id === distributorId && e.is_printed && !e.is_sold
      ),
    [allEditions, distributorId]
  )

  // Filter by search
  const filteredEditions = useMemo(() => {
    if (!search.trim()) return stockEditions

    const searchLower = search.toLowerCase()
    // Smart search: "Bembridge 47" matches artwork name + edition number
    const match = search.match(/^(.+?)[\s#-]*(\d+)$/)

    return stockEditions.filter((e) => {
      if (match) {
        const artworkSearch = match[1].trim().toLowerCase()
        const editionNum = parseInt(match[2])
        if (
          e.edition_number === editionNum &&
          e.prints?.name?.toLowerCase().includes(artworkSearch)
        ) {
          return true
        }
      }
      // Regular search
      return (
        e.edition_display_name.toLowerCase().includes(searchLower) ||
        e.prints?.name?.toLowerCase().includes(searchLower)
      )
    })
  }, [stockEditions, search])

  // Group by artwork
  const artworkGroups = useMemo(() => {
    const groups = new Map<number, ArtworkGroup>()

    for (const edition of filteredEditions) {
      const printId = edition.print_id
      if (!groups.has(printId)) {
        groups.set(printId, {
          printId,
          printName: edition.prints?.name || 'Unknown Artwork',
          editions: [],
          checkedCount: 0,
          flaggedCount: 0,
        })
      }
      const group = groups.get(printId)!
      group.editions.push(edition)
      if (edition.is_stock_checked) group.checkedCount++
      if (edition.to_check_in_detail) group.flaggedCount++
    }

    // Sort editions within each group by edition number
    for (const group of groups.values()) {
      group.editions.sort((a, b) => (a.edition_number || 0) - (b.edition_number || 0))
    }

    // Sort groups by artwork name
    return Array.from(groups.values()).sort((a, b) =>
      a.printName.localeCompare(b.printName)
    )
  }, [filteredEditions])

  // Progress stats
  const progress = useMemo(() => {
    const total = stockEditions.length
    const checked = stockEditions.filter((e) => e.is_stock_checked).length
    const flagged = stockEditions.filter((e) => e.to_check_in_detail).length
    const percentage = total > 0 ? Math.round((checked / total) * 100) : 0
    return { total, checked, flagged, percentage }
  }, [stockEditions])

  const toggleGroup = useCallback((printId: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(printId)) {
        next.delete(printId)
      } else {
        next.add(printId)
      }
      return next
    })
  }, [])

  const handleCheck = useCallback(
    async (editionId: number, checked: boolean) => {
      await markStockChecked([editionId], checked)
    },
    [markStockChecked]
  )

  const handleFlag = useCallback(
    async (editionId: number, flagged: boolean) => {
      await markNeedsReview([editionId], flagged)
    },
    [markNeedsReview]
  )

  const handleCheckAllInGroup = useCallback(
    async (group: ArtworkGroup) => {
      const uncheckedIds = group.editions
        .filter((e) => !e.is_stock_checked)
        .map((e) => e.id)
      if (uncheckedIds.length > 0) {
        await markStockChecked(uncheckedIds, true)
      }
    },
    [markStockChecked]
  )

  const handleReset = useCallback(async () => {
    if (!confirm('Reset all stock check progress for this gallery? This will uncheck all items.')) {
      return
    }
    setIsResetting(true)
    await resetStockCheckForGallery(distributorId)
    setIsResetting(false)
  }, [resetStockCheckForGallery, distributorId])

  if (!isReady) return null

  if (!distributor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/galleries" className="hover:text-gray-900">
            Galleries
          </Link>
          <span>/</span>
          <span className="text-gray-900">Not Found</span>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Gallery not found</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/galleries">Back to Galleries</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isComplete = progress.checked === progress.total && progress.total > 0

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/galleries" className="hover:text-gray-900">
          Galleries
        </Link>
        <span>/</span>
        <Link href={`/galleries/${id}`} className="hover:text-gray-900">
          {distributor.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900">Stock Check</span>
      </div>

      {/* Header with Progress */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/galleries/${id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Check</h1>
            <p className="text-gray-600">{distributor.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isResetting || isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Progress Card */}
      <Card
        className={cn(
          'border-2 transition-colors',
          isComplete ? 'border-green-500 bg-green-50' : 'border-gray-200'
        )}
      >
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isComplete ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700">Stock Check Complete</span>
                </>
              ) : (
                <span className="font-medium text-gray-700">
                  {progress.checked} of {progress.total} verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              {progress.flagged > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  {progress.flagged} flagged
                </span>
              )}
              <span className="font-mono text-gray-600">{progress.percentage}%</span>
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                isComplete ? 'bg-green-500' : 'bg-blue-500'
              )}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search editions... (e.g., Bembridge 47)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Artwork Groups */}
      <div className="space-y-3">
        {artworkGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {search ? 'No editions match your search' : 'No stock at this location'}
              </p>
            </CardContent>
          </Card>
        ) : (
          artworkGroups.map((group) => (
            <ArtworkGroupCard
              key={group.printId}
              group={group}
              isCollapsed={collapsedGroups.has(group.printId)}
              onToggle={() => toggleGroup(group.printId)}
              onCheck={handleCheck}
              onFlag={handleFlag}
              onCheckAll={() => handleCheckAllInGroup(group)}
              isSaving={isSaving}
            />
          ))
        )}
      </div>

      {/* Back button */}
      <Button variant="outline" asChild>
        <Link href={`/galleries/${id}`}>Back to Gallery</Link>
      </Button>
    </div>
  )
}

// Artwork Group Component
function ArtworkGroupCard({
  group,
  isCollapsed,
  onToggle,
  onCheck,
  onFlag,
  onCheckAll,
  isSaving,
}: {
  group: ArtworkGroup
  isCollapsed: boolean
  onToggle: () => void
  onCheck: (id: number, checked: boolean) => void
  onFlag: (id: number, flagged: boolean) => void
  onCheckAll: () => void
  isSaving: boolean
}) {
  const allChecked = group.checkedCount === group.editions.length
  const uncheckedCount = group.editions.length - group.checkedCount

  return (
    <Card>
      {/* Group Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
          <span className="font-serif font-medium text-gray-900">{group.printName}</span>
          <span className="text-sm text-gray-500">({group.editions.length})</span>
        </div>
        <div className="flex items-center gap-3">
          {group.flaggedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {group.flaggedCount}
            </span>
          )}
          <span
            className={cn(
              'text-sm font-medium',
              allChecked ? 'text-green-600' : 'text-gray-500'
            )}
          >
            {group.checkedCount}/{group.editions.length}
          </span>
        </div>
      </button>

      {/* Edition List */}
      {!isCollapsed && (
        <div className="border-t">
          {/* Check All Button */}
          {uncheckedCount > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onCheckAll()
                }}
                disabled={isSaving}
                className="text-blue-600 hover:text-blue-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Check all {uncheckedCount} remaining
              </Button>
            </div>
          )}

          {/* Editions */}
          <div className="divide-y">
            {group.editions.map((edition) => (
              <EditionCheckRow
                key={edition.id}
                edition={edition}
                onCheck={onCheck}
                onFlag={onFlag}
                isSaving={isSaving}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// Individual Edition Row
function EditionCheckRow({
  edition,
  onCheck,
  onFlag,
  isSaving,
}: {
  edition: EditionWithRelations
  onCheck: (id: number, checked: boolean) => void
  onFlag: (id: number, flagged: boolean) => void
  isSaving: boolean
}) {
  const isChecked = edition.is_stock_checked ?? false
  const isFlagged = edition.to_check_in_detail ?? false

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 transition-colors',
        isChecked && 'bg-green-50',
        isFlagged && !isChecked && 'bg-amber-50'
      )}
    >
      <div className="flex items-center gap-4">
        {/* Large touch-friendly checkbox */}
        <button
          onClick={() => onCheck(edition.id, !isChecked)}
          disabled={isSaving}
          className={cn(
            'w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all',
            'hover:scale-105 active:scale-95',
            isChecked
              ? 'bg-green-500 border-green-500 text-white'
              : 'bg-white border-gray-300 hover:border-gray-400'
          )}
        >
          {isChecked && <CheckCircle2 className="h-6 w-6" />}
        </button>

        <div>
          <p
            className={cn(
              'font-mono font-medium',
              isChecked ? 'text-green-700' : 'text-gray-900'
            )}
          >
            {edition.edition_number}/{edition.prints?.total_editions || '?'}
          </p>
          {(edition.size || edition.frame_type) && (
            <p className="text-sm text-gray-500">
              {[edition.size, edition.frame_type].filter(Boolean).join(' • ')}
            </p>
          )}
        </div>
      </div>

      {/* Flag button */}
      <button
        onClick={() => onFlag(edition.id, !isFlagged)}
        disabled={isSaving}
        className={cn(
          'p-2 rounded-lg transition-colors',
          isFlagged
            ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
            : 'text-gray-400 hover:bg-gray-100 hover:text-amber-500'
        )}
        title={isFlagged ? 'Remove flag' : 'Flag for review'}
      >
        <AlertTriangle className="h-5 w-5" />
      </button>
    </div>
  )
}
