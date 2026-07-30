'use client'

import { use, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { cn, compareEditions, isArtistProof } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  MapPinOff,
  Plus,
  X,
} from 'lucide-react'
import type { EditionWithRelations } from '@/lib/types'

type PageProps = {
  params: Promise<{ id: string }>
}

type ArtworkGroup = {
  printId: number
  printName: string
  editions: EditionWithRelations[]
}

// How many quick-add matches to render before asking for a narrower search.
const ADD_RESULT_LIMIT = 20

/** "Bembridge 47" -> artwork name + edition number, if the query looks like that. */
function parseSmartSearch(query: string): { artwork: string; editionNum: number } | null {
  const match = query.match(/^(.+?)[\s#-]*(\d+)$/)
  if (!match) return null
  return { artwork: match[1].trim().toLowerCase(), editionNum: parseInt(match[2]) }
}

function groupByArtwork(editions: EditionWithRelations[]): ArtworkGroup[] {
  const groups = new Map<number, ArtworkGroup>()

  for (const edition of editions) {
    let group = groups.get(edition.print_id)
    if (!group) {
      group = {
        printId: edition.print_id,
        printName: edition.prints?.name || 'Unknown Artwork',
        editions: [],
      }
      groups.set(edition.print_id, group)
    }
    group.editions.push(edition)
  }

  for (const group of groups.values()) {
    group.editions.sort(compareEditions)
  }

  return Array.from(groups.values()).sort((a, b) => a.printName.localeCompare(b.printName))
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
    markLocationUnknown,
    addStockToGallery,
    unknownDistributor,
  } = useInventory()

  const [search, setSearch] = useState('')
  const [showConfirmed, setShowConfirmed] = useState(true)
  const [addSearch, setAddSearch] = useState('')
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split('T')[0])

  const distributor = useMemo(
    () => distributors.find((d) => d.id === distributorId),
    [distributors, distributorId]
  )

  // Everything the records place at this gallery right now.
  const stockEditions = useMemo(
    () =>
      allEditions.filter(
        (e) => e.distributor_id === distributorId && e.is_printed && !e.is_sold
      ),
    [allEditions, distributorId]
  )

  const filteredEditions = useMemo(() => {
    if (!search.trim()) return stockEditions

    const searchLower = search.toLowerCase()
    const smart = parseSmartSearch(search)

    return stockEditions.filter((e) => {
      if (
        smart &&
        e.edition_number === smart.editionNum &&
        e.prints?.name?.toLowerCase().includes(smart.artwork)
      ) {
        return true
      }
      return (
        e.edition_display_name.toLowerCase().includes(searchLower) ||
        e.prints?.name?.toLowerCase().includes(searchLower)
      )
    })
  }, [stockEditions, search])

  const unconfirmedGroups = useMemo(
    () => groupByArtwork(filteredEditions.filter((e) => !e.is_stock_checked)),
    [filteredEditions]
  )

  const confirmedGroups = useMemo(
    () => groupByArtwork(filteredEditions.filter((e) => e.is_stock_checked)),
    [filteredEditions]
  )

  const counts = useMemo(() => {
    const total = stockEditions.length
    const confirmed = stockEditions.filter((e) => e.is_stock_checked).length
    return {
      total,
      confirmed,
      unconfirmed: total - confirmed,
      percentage: total > 0 ? Math.round((confirmed / total) * 100) : 0,
    }
  }, [stockEditions])

  // Quick add: candidates are existing edition rows held anywhere else. The
  // catalogue pre-creates every edition, so adding stock moves a row here
  // rather than inserting one — inserting would duplicate an edition number.
  const addCandidates = useMemo(() => {
    const query = addSearch.trim().toLowerCase()
    if (query.length < 2) return []

    const smart = parseSmartSearch(addSearch.trim())

    const matches = allEditions.filter((e) => {
      if (e.distributor_id === distributorId) return false
      if (e.is_sold) return false
      if (e.status_confidence === 'legacy_unknown') return false

      const artworkName = e.prints?.name?.toLowerCase() || ''
      if (
        smart &&
        e.edition_number === smart.editionNum &&
        artworkName.includes(smart.artwork)
      ) {
        return true
      }
      return (
        artworkName.includes(query) ||
        e.edition_display_name.toLowerCase().includes(query)
      )
    })

    matches.sort(
      (a, b) =>
        (a.prints?.name || '').localeCompare(b.prints?.name || '') || compareEditions(a, b)
    )

    return matches
  }, [allEditions, addSearch, distributorId])

  const handleToggleConfirm = useCallback(
    (editionId: number, confirmed: boolean) => markStockChecked([editionId], confirmed),
    [markStockChecked]
  )

  const handleNotHere = useCallback(
    async (edition: EditionWithRelations) => {
      const label = `${edition.prints?.name || 'this edition'} ${edition.edition_number ?? ''}`.trim()
      if (
        !confirm(
          `Set the location of ${label} to Unknown? It leaves this gallery's stock and its in-gallery date is cleared.`
        )
      ) {
        return
      }
      await markLocationUnknown([edition.id])
    },
    [markLocationUnknown]
  )

  const handleConfirmGroup = useCallback(
    (group: ArtworkGroup) => {
      const ids = group.editions.filter((e) => !e.is_stock_checked).map((e) => e.id)
      if (ids.length > 0) markStockChecked(ids, true)
    },
    [markStockChecked]
  )

  const handleAdd = useCallback(
    async (edition: EditionWithRelations) => {
      await addStockToGallery([edition.id], distributorId, addDate)
      setAddSearch('')
    },
    [addStockToGallery, distributorId, addDate]
  )

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

      {/* Header */}
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

      {/* Standing tally — confirmations persist, nothing resets them */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-gray-700">
                {counts.total} in stock
              </span>
              <span className="flex items-center gap-1 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                {counts.confirmed} confirmed
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <Circle className="h-4 w-4" />
                {counts.unconfirmed} unconfirmed
              </span>
            </div>
            <span className="font-mono text-sm text-gray-600">{counts.percentage}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${counts.percentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick add */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="add-stock">Add stock to {distributor.name}</Label>
              <div className="relative">
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="add-stock"
                  type="text"
                  placeholder="Artwork and edition number (e.g. Bembridge 47)"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  className="pl-10 pr-9"
                />
                {addSearch && (
                  <button
                    onClick={() => setAddSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    aria-label="Clear"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1 sm:w-44">
              <Label htmlFor="add-date">In gallery from</Label>
              <Input
                id="add-date"
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
              />
            </div>
          </div>

          {addSearch.trim().length >= 2 && (
            <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
              {addCandidates.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  No edition elsewhere matches that. Editions already here, sold ones and
                  legacy-unknown rows are excluded.
                </p>
              ) : (
                <>
                  {addCandidates.slice(0, ADD_RESULT_LIMIT).map((edition) => (
                    <div
                      key={edition.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate">
                          <span className="font-serif">{edition.prints?.name}</span>
                          <span className="font-mono ml-2">
                            {edition.edition_number ?? '?'}
                            {edition.prints?.total_editions
                              ? `/${edition.prints.total_editions}`
                              : ''}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {[
                            edition.distributors?.name || 'Direct',
                            edition.is_printed ? null : 'not marked printed',
                            edition.size,
                            edition.frame_type,
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAdd(edition)}
                        disabled={isSaving}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                  {addCandidates.length > ADD_RESULT_LIMIT && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      {addCandidates.length - ADD_RESULT_LIMIT} more match — narrow the
                      search.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search within this gallery's stock */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search this gallery's stock... (e.g. Bembridge 47)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {counts.total === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No stock at this location</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Confirmed first, but collapsible: once a gallery is mostly done it
              is a long list to scroll past to reach what still needs doing. */}
          <div>
            <button
              onClick={() => setShowConfirmed((v) => !v)}
              className="flex items-baseline gap-2 text-left"
            >
              {showConfirmed ? (
                <ChevronDown className="h-4 w-4 self-center text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 self-center text-gray-400" />
              )}
              <h2 className="text-lg font-semibold text-gray-900">
                Confirmed ({confirmedGroups.reduce((n, g) => n + g.editions.length, 0)})
              </h2>
              <span className="text-sm text-gray-500">Seen at this gallery</span>
            </button>
            {showConfirmed && (
              <div className="mt-3">
                <StockSection
                  groups={confirmedGroups}
                  emptyMessage={
                    search ? 'No confirmed editions match your search' : 'Nothing confirmed yet'
                  }
                  tone="confirmed"
                  onToggleConfirm={handleToggleConfirm}
                  onNotHere={handleNotHere}
                  onConfirmGroup={handleConfirmGroup}
                  canMarkUnknown={Boolean(unknownDistributor)}
                  isSaving={isSaving}
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Unconfirmed ({unconfirmedGroups.reduce((n, g) => n + g.editions.length, 0)})
              </h2>
              <span className="text-sm text-gray-500">Recorded here, not yet seen</span>
            </div>
            <div className="mt-3">
              <StockSection
                groups={unconfirmedGroups}
                emptyMessage={
                  search
                    ? 'No unconfirmed editions match your search'
                    : 'Everything here is confirmed'
                }
                tone="unconfirmed"
                onToggleConfirm={handleToggleConfirm}
                onNotHere={handleNotHere}
                onConfirmGroup={handleConfirmGroup}
                canMarkUnknown={Boolean(unknownDistributor)}
                isSaving={isSaving}
              />
            </div>
          </div>
        </div>
      )}

      {!unknownDistributor && (
        <p className="text-sm text-amber-700">
          No distributor named &ldquo;Unknown&rdquo; exists, so the &ldquo;not here&rdquo;
          action is unavailable.
        </p>
      )}

      <Button variant="outline" asChild>
        <Link href={`/galleries/${id}`}>Back to Gallery</Link>
      </Button>
    </div>
  )
}

function StockSection({
  groups,
  emptyMessage,
  tone,
  onToggleConfirm,
  onNotHere,
  onConfirmGroup,
  canMarkUnknown,
  isSaving,
}: {
  groups: ArtworkGroup[]
  emptyMessage: string
  tone: 'confirmed' | 'unconfirmed'
  onToggleConfirm: (id: number, confirmed: boolean) => void
  onNotHere: (edition: EditionWithRelations) => void
  onConfirmGroup: (group: ArtworkGroup) => void
  canMarkUnknown: boolean
  isSaving: boolean
}) {
  const total = groups.reduce((n, g) => n + g.editions.length, 0)

  return (
    <div className="space-y-3">
      {total === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.printId}>
            <div className="px-4 py-3 flex items-center justify-between border-b">
              <div className="flex items-center gap-3">
                <span className="font-serif font-medium text-gray-900">
                  {group.printName}
                </span>
                <span className="text-sm text-gray-500">({group.editions.length})</span>
              </div>
              {tone === 'unconfirmed' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onConfirmGroup(group)}
                  disabled={isSaving}
                  className="text-green-700 hover:text-green-800"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm all {group.editions.length}
                </Button>
              )}
            </div>
            <div className="divide-y">
              {group.editions.map((edition) => (
                <EditionRow
                  key={edition.id}
                  edition={edition}
                  onToggleConfirm={onToggleConfirm}
                  onNotHere={onNotHere}
                  canMarkUnknown={canMarkUnknown}
                  isSaving={isSaving}
                />
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

function EditionRow({
  edition,
  onToggleConfirm,
  onNotHere,
  canMarkUnknown,
  isSaving,
}: {
  edition: EditionWithRelations
  onToggleConfirm: (id: number, confirmed: boolean) => void
  onNotHere: (edition: EditionWithRelations) => void
  canMarkUnknown: boolean
  isSaving: boolean
}) {
  const isConfirmed = edition.is_stock_checked ?? false

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 transition-colors',
        isConfirmed && 'bg-green-50'
      )}
    >
      <div className="flex items-center gap-4">
        {/* Large touch-friendly confirm toggle */}
        <button
          onClick={() => onToggleConfirm(edition.id, !isConfirmed)}
          disabled={isSaving}
          className={cn(
            'w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all',
            'hover:scale-105 active:scale-95',
            isConfirmed
              ? 'bg-green-500 border-green-500 text-white'
              : 'bg-white border-gray-300 hover:border-gray-400'
          )}
          title={isConfirmed ? 'Remove confirmation' : 'Confirm it is here'}
        >
          {isConfirmed && <CheckCircle2 className="h-6 w-6" />}
        </button>

        <div>
          <p
            className={cn(
              'font-mono font-medium',
              isConfirmed ? 'text-green-700' : 'text-gray-900'
            )}
          >
            {isArtistProof(edition)
              ? `AP ${edition.edition_number ?? '?'}`
              : `${edition.edition_number ?? '?'}/${edition.prints?.total_editions || '?'}`}
          </p>
          {(edition.size || edition.frame_type) && (
            <p className="text-sm text-gray-500">
              {[edition.size, edition.frame_type].filter(Boolean).join(' • ')}
            </p>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNotHere(edition)}
        disabled={isSaving || !canMarkUnknown}
        className="text-gray-500 hover:text-amber-700"
        title="Not at this gallery — set location to Unknown"
      >
        <MapPinOff className="h-4 w-4 mr-2" />
        Not here
      </Button>
    </div>
  )
}
