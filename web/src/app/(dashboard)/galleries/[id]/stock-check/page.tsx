'use client'

import { use, useMemo, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useInventory } from '@/lib/hooks/use-inventory'
import { cn, compareEditions, isArtistProof } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EditionDetailDialog } from '@/components/editions/edition-detail-dialog'
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  MapPinOff,
  Plus,
  RotateCcw,
  Undo2,
  X,
} from 'lucide-react'
import type { EditionWithRelations } from '@/lib/types'

type PageProps = {
  params: Promise<{ id: string }>
}

type Group = {
  key: string
  label: string
  editions: EditionWithRelations[]
}

type GroupBy = 'artwork' | 'size' | 'frame'

// How many quick-add matches to render before asking for a narrower search.
const ADD_RESULT_LIMIT = 20

// Radix Select rejects an empty item value, so "everything" and "no artwork
// picked" need sentinels of their own rather than ''.
const ANY_ARTWORK = 'any'
const ALL = 'all'

// Rows with nothing recorded for the grouping field sort last, whatever their
// label would sort as. A blank size means unmeasured, not a category.
const UNRECORDED = '￿'

/** "Bembridge 47" -> artwork name + edition number, if the query looks like that. */
function parseSmartSearch(query: string): { artwork: string; editionNum: number } | null {
  const match = query.match(/^(.+?)[\s#-]*(\d+)$/)
  if (!match) return null
  return { artwork: match[1].trim().toLowerCase(), editionNum: parseInt(match[2]) }
}

function groupKeyFor(
  edition: EditionWithRelations,
  groupBy: GroupBy
): { key: string; label: string } {
  if (groupBy === 'size') {
    return edition.size
      ? { key: edition.size, label: edition.size }
      : { key: UNRECORDED, label: 'Size not measured' }
  }
  if (groupBy === 'frame') {
    return edition.frame_type
      ? { key: edition.frame_type, label: edition.frame_type }
      : { key: UNRECORDED, label: 'No frame type recorded' }
  }
  return {
    key: String(edition.print_id),
    label: edition.prints?.name || 'Unknown Artwork',
  }
}

function groupEditions(editions: EditionWithRelations[], groupBy: GroupBy): Group[] {
  const groups = new Map<string, Group>()

  for (const edition of editions) {
    const { key, label } = groupKeyFor(edition, groupBy)
    let group = groups.get(key)
    if (!group) {
      group = { key, label, editions: [] }
      groups.set(key, group)
    }
    group.editions.push(edition)
  }

  // Grouped by artwork, the edition number alone orders a group. Grouped by
  // size or frame a group spans artworks, so the name has to come first or the
  // numbers read as a jumble.
  for (const group of groups.values()) {
    group.editions.sort((a, b) =>
      groupBy === 'artwork'
        ? compareEditions(a, b)
        : (a.prints?.name || '').localeCompare(b.prints?.name || '') || compareEditions(a, b)
    )
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === UNRECORDED) return 1
    if (b.key === UNRECORDED) return -1
    return a.label.localeCompare(b.label)
  })
}

function countIn(groups: Group[]): number {
  return groups.reduce((n, g) => n + g.editions.length, 0)
}

export default function StockCheckPage({ params }: PageProps) {
  const { id } = use(params)
  const distributorId = parseInt(id)
  const {
    distributors,
    allEditions,
    prints,
    sizes,
    frameTypes,
    isReady,
    isSaving,
    markStockChecked,
    markLocationUnknown,
    addStockToGallery,
    unknownDistributor,
  } = useInventory()

  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('artwork')
  const [filterPrintId, setFilterPrintId] = useState('')
  const [filterSize, setFilterSize] = useState('')
  const [filterFrame, setFilterFrame] = useState('')
  const [showConfirmed, setShowConfirmed] = useState(true)
  const [addSearch, setAddSearch] = useState('')
  const [addPrintId, setAddPrintId] = useState('')
  const [clearedIds, setClearedIds] = useState<number[] | null>(null)
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split('T')[0])
  const [detailEdition, setDetailEdition] = useState<EditionWithRelations | null>(null)

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

  // Only values actually present in this gallery's stock, so a filter can never
  // offer a choice that yields nothing.
  const stockSizes = useMemo(() => {
    const present = new Set(stockEditions.map((e) => e.size).filter(Boolean) as string[])
    return sizes.filter((s) => present.has(s))
  }, [stockEditions, sizes])

  const stockFrameTypes = useMemo(() => {
    const present = new Set(
      stockEditions.map((e) => e.frame_type).filter(Boolean) as string[]
    )
    return frameTypes.filter((f) => present.has(f))
  }, [stockEditions, frameTypes])

  const stockPrints = useMemo(() => {
    const present = new Set(stockEditions.map((e) => e.print_id))
    return prints.filter((p) => present.has(p.id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [stockEditions, prints])

  const hasNarrowing = Boolean(search.trim() || filterPrintId || filterSize || filterFrame)

  const filteredEditions = useMemo(() => {
    const searchLower = search.trim().toLowerCase()
    const smart = searchLower ? parseSmartSearch(search.trim()) : null
    const printId = filterPrintId ? parseInt(filterPrintId) : null

    return stockEditions.filter((e) => {
      if (printId && e.print_id !== printId) return false
      if (filterSize && e.size !== filterSize) return false
      if (filterFrame && e.frame_type !== filterFrame) return false

      if (!searchLower) return true
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
  }, [stockEditions, search, filterPrintId, filterSize, filterFrame])

  const unconfirmedGroups = useMemo(
    () => groupEditions(filteredEditions.filter((e) => !e.is_stock_checked), groupBy),
    [filteredEditions, groupBy]
  )

  const confirmedGroups = useMemo(
    () => groupEditions(filteredEditions.filter((e) => e.is_stock_checked), groupBy),
    [filteredEditions, groupBy]
  )

  const confirmedCount = useMemo(() => countIn(confirmedGroups), [confirmedGroups])
  const unconfirmedCount = useMemo(() => countIn(unconfirmedGroups), [unconfirmedGroups])

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

  // Artwork options for the add dropdown: favourites first, then alphabetical.
  const printOptions = useMemo(
    () =>
      [...prints].sort(
        (a, b) =>
          Number(Boolean(b.is_favorite)) - Number(Boolean(a.is_favorite)) ||
          a.name.localeCompare(b.name)
      ),
    [prints]
  )

  // Quick add: candidates are existing edition rows held anywhere else. The
  // catalogue pre-creates every edition, so adding stock moves a row here
  // rather than inserting one — inserting would duplicate an edition number.
  //
  // Two ways in, and they compose: pick the artwork from the dropdown and the
  // typed text narrows to an edition number, or type "Bembridge 47" and skip
  // the dropdown entirely. With no artwork picked, a bare search needs two
  // characters before it lists anything, or the first keystroke would render
  // thousands of rows.
  const addCandidates = useMemo(() => {
    const query = addSearch.trim().toLowerCase()
    const printId = addPrintId ? parseInt(addPrintId) : null
    if (!printId && query.length < 2) return []

    const smart = parseSmartSearch(addSearch.trim())
    const editionNum = /^\d+$/.test(query) ? parseInt(query) : null

    const matches = allEditions.filter((e) => {
      if (e.distributor_id === distributorId) return false
      if (e.is_sold) return false
      if (e.status_confidence === 'legacy_unknown') return false
      if (printId && e.print_id !== printId) return false

      if (!query) return true

      // A bare number means an edition number, not a substring of a name.
      if (editionNum !== null) return e.edition_number === editionNum

      const artworkName = e.prints?.name?.toLowerCase() || ''
      if (
        smart &&
        e.edition_number === smart.editionNum &&
        artworkName.includes(smart.artwork)
      ) {
        return true
      }
      return (
        artworkName.includes(query) || e.edition_display_name.toLowerCase().includes(query)
      )
    })

    matches.sort(
      (a, b) =>
        (a.prints?.name || '').localeCompare(b.prints?.name || '') || compareEditions(a, b)
    )

    return matches
  }, [allEditions, addSearch, addPrintId, distributorId])

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
    (group: Group) => {
      const ids = group.editions.filter((e) => !e.is_stock_checked).map((e) => e.id)
      if (ids.length > 0) markStockChecked(ids, true)
    },
    [markStockChecked]
  )

  // Clears exactly what the Confirmed section is showing, so a search or filter
  // narrows the button as well as the list. The ids are kept for the undo.
  const handleClearConfirmed = useCallback(async () => {
    const ids = confirmedGroups.flatMap((g) => g.editions.map((e) => e.id))
    if (ids.length === 0) return
    const ok = await markStockChecked(ids, false)
    if (ok) setClearedIds(ids)
  }, [confirmedGroups, markStockChecked])

  const handleUndoClear = useCallback(async () => {
    if (!clearedIds) return
    const ok = await markStockChecked(clearedIds, true)
    if (ok) setClearedIds(null)
  }, [clearedIds, markStockChecked])

  // Ctrl/Cmd-Z while the undo banner is up, so the reflex people already have
  // works. Only while it is up, and never while typing in a field.
  useEffect(() => {
    if (!clearedIds) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      event.preventDefault()
      void handleUndoClear()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clearedIds, handleUndoClear])

  const handleAdd = useCallback(
    async (edition: EditionWithRelations) => {
      await addStockToGallery([edition.id], distributorId, addDate)
      setAddSearch('')
    },
    [addStockToGallery, distributorId, addDate]
  )

  const clearNarrowing = useCallback(() => {
    setSearch('')
    setFilterPrintId('')
    setFilterSize('')
    setFilterFrame('')
  }, [])

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

      {/* Standing tally — confirmations persist, nothing clears them by itself */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-gray-700">{counts.total} in stock</span>
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
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-gray-400" />
            <Label>Add stock to {distributor.name}</Label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1 sm:w-64">
              <Label htmlFor="add-artwork" className="text-xs text-gray-500">
                Artwork
              </Label>
              <div className="flex gap-1">
                <Select
                  value={addPrintId}
                  onValueChange={(value) => setAddPrintId(value === ANY_ARTWORK ? '' : value)}
                >
                  <SelectTrigger id="add-artwork" className="flex-1">
                    <SelectValue placeholder="Any artwork" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_ARTWORK}>Any artwork</SelectItem>
                    {printOptions.map((print) => (
                      <SelectItem key={print.id} value={String(print.id)}>
                        {print.is_favorite ? '★ ' : ''}
                        {print.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {addPrintId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAddPrintId('')}
                    aria-label="Clear artwork"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-1">
              <Label htmlFor="add-stock" className="text-xs text-gray-500">
                {addPrintId ? 'Edition number' : 'Artwork and edition number'}
              </Label>
              <div className="relative">
                <Input
                  id="add-stock"
                  type="text"
                  placeholder={addPrintId ? 'e.g. 47' : 'e.g. Bembridge 47'}
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  className="pr-9"
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
              <Label htmlFor="add-date" className="text-xs text-gray-500">
                In gallery from
              </Label>
              <Input
                id="add-date"
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
              />
            </div>
          </div>

          {(addPrintId || addSearch.trim().length >= 2) && (
            <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
              {addCandidates.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Nothing held elsewhere matches. Editions already at this gallery, sold ones
                  and legacy-unknown rows are excluded.
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
                            {isArtistProof(edition)
                              ? `AP ${edition.edition_number ?? '?'}`
                              : `${edition.edition_number ?? '?'}${
                                  edition.prints?.total_editions
                                    ? `/${edition.prints.total_editions}`
                                    : ''
                                }`}
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
                      <Button size="sm" onClick={() => handleAdd(edition)} disabled={isSaving}>
                        Add
                      </Button>
                    </div>
                  ))}
                  {addCandidates.length > ADD_RESULT_LIMIT && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      {addCandidates.length - ADD_RESULT_LIMIT} more match — type an edition
                      number to narrow.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search, filter, group */}
      <Card>
        <CardContent className="py-4 space-y-3">
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Group by</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="artwork">Artwork</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                  <SelectItem value="frame">Frame type</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Artwork</Label>
              <Select
                value={filterPrintId || ALL}
                onValueChange={(v) => setFilterPrintId(v === ALL ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All artworks</SelectItem>
                  {stockPrints.map((print) => (
                    <SelectItem key={print.id} value={String(print.id)}>
                      {print.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Size</Label>
              <Select
                value={filterSize || ALL}
                onValueChange={(v) => setFilterSize(v === ALL ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All sizes</SelectItem>
                  {stockSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Frame type</Label>
              <Select
                value={filterFrame || ALL}
                onValueChange={(v) => setFilterFrame(v === ALL ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All frame types</SelectItem>
                  {stockFrameTypes.map((frame) => (
                    <SelectItem key={frame} value={frame}>
                      {frame}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasNarrowing && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
              <span>
                Showing {confirmedCount + unconfirmedCount} of {counts.total}. A size or frame
                filter matches only what has been recorded, so unmeasured rows drop out.
              </span>
              <Button variant="ghost" size="sm" onClick={clearNarrowing}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
            <div className="flex flex-wrap items-center justify-between gap-2">
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
                  Confirmed ({confirmedCount})
                </h2>
                <span className="text-sm text-gray-500">Seen at this gallery</span>
              </button>
              {confirmedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearConfirmed}
                  disabled={isSaving}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear {confirmedCount} confirmation{confirmedCount === 1 ? '' : 's'}
                  {hasNarrowing ? ' shown' : ''}
                </Button>
              )}
            </div>

            {/* Undo lives here rather than in a prompt: clearing is cheap to
                reverse, so the safety net is after the fact, not before it.
                It survives until used or dismissed, but not a page reload. */}
            {clearedIds && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <span className="text-amber-900">
                  Cleared {clearedIds.length} confirmation
                  {clearedIds.length === 1 ? '' : 's'}.
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUndoClear}
                    disabled={isSaving}
                  >
                    <Undo2 className="h-4 w-4 mr-2" />
                    Undo
                    <span className="ml-2 hidden text-xs text-gray-500 sm:inline">
                      ⌘/Ctrl+Z
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setClearedIds(null)}
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {showConfirmed && (
              <div className="mt-3">
                <StockSection
                  groups={confirmedGroups}
                  groupBy={groupBy}
                  emptyMessage={
                    hasNarrowing ? 'No confirmed editions match' : 'Nothing confirmed yet'
                  }
                  tone="confirmed"
                  onToggleConfirm={handleToggleConfirm}
                  onNotHere={handleNotHere}
                  onConfirmGroup={handleConfirmGroup}
                  onShowDetail={setDetailEdition}
                  canMarkUnknown={Boolean(unknownDistributor)}
                  isSaving={isSaving}
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Unconfirmed ({unconfirmedCount})
              </h2>
              <span className="text-sm text-gray-500">Recorded here, not yet seen</span>
            </div>
            <div className="mt-3">
              <StockSection
                groups={unconfirmedGroups}
                groupBy={groupBy}
                emptyMessage={
                  hasNarrowing ? 'No unconfirmed editions match' : 'Everything here is confirmed'
                }
                tone="unconfirmed"
                onToggleConfirm={handleToggleConfirm}
                onNotHere={handleNotHere}
                onConfirmGroup={handleConfirmGroup}
                onShowDetail={setDetailEdition}
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

      <EditionDetailDialog
        key={detailEdition?.id ?? 'none'}
        edition={detailEdition}
        open={detailEdition !== null}
        onOpenChange={(open) => {
          if (!open) setDetailEdition(null)
        }}
      />
    </div>
  )
}

function StockSection({
  groups,
  groupBy,
  emptyMessage,
  tone,
  onToggleConfirm,
  onNotHere,
  onConfirmGroup,
  onShowDetail,
  canMarkUnknown,
  isSaving,
}: {
  groups: Group[]
  groupBy: GroupBy
  emptyMessage: string
  tone: 'confirmed' | 'unconfirmed'
  onToggleConfirm: (id: number, confirmed: boolean) => void
  onNotHere: (edition: EditionWithRelations) => void
  onConfirmGroup: (group: Group) => void
  onShowDetail: (edition: EditionWithRelations) => void
  canMarkUnknown: boolean
  isSaving: boolean
}) {
  const total = countIn(groups)

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
          <Card key={group.key}>
            <div className="px-4 py-3 flex items-center justify-between border-b">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'font-medium text-gray-900',
                    groupBy === 'artwork' && 'font-serif'
                  )}
                >
                  {group.label}
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
                  showArtwork={groupBy !== 'artwork'}
                  onToggleConfirm={onToggleConfirm}
                  onNotHere={onNotHere}
                  onShowDetail={onShowDetail}
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
  showArtwork,
  onToggleConfirm,
  onNotHere,
  onShowDetail,
  canMarkUnknown,
  isSaving,
}: {
  edition: EditionWithRelations
  showArtwork: boolean
  onToggleConfirm: (id: number, confirmed: boolean) => void
  onNotHere: (edition: EditionWithRelations) => void
  onShowDetail: (edition: EditionWithRelations) => void
  canMarkUnknown: boolean
  isSaving: boolean
}) {
  const isConfirmed = edition.is_stock_checked ?? false
  const editionLabel = isArtistProof(edition)
    ? `AP ${edition.edition_number ?? '?'}`
    : `${edition.edition_number ?? '?'}/${edition.prints?.total_editions || '?'}`

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-4 py-3 transition-colors',
        isConfirmed && 'bg-green-50'
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        {/* Large touch-friendly confirm toggle */}
        <button
          onClick={() => onToggleConfirm(edition.id, !isConfirmed)}
          disabled={isSaving}
          className={cn(
            'w-10 h-10 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all',
            'hover:scale-105 active:scale-95',
            isConfirmed
              ? 'bg-green-500 border-green-500 text-white'
              : 'bg-white border-gray-300 hover:border-gray-400'
          )}
          title={isConfirmed ? 'Remove confirmation' : 'Confirm it is here'}
        >
          {isConfirmed && <CheckCircle2 className="h-6 w-6" />}
        </button>

        {/* Everything else opens the record */}
        <button
          onClick={() => onShowDetail(edition)}
          className="min-w-0 text-left group"
          title="Show full record and recent changes"
        >
          {showArtwork && (
            <p className="font-serif text-sm text-gray-700 truncate group-hover:underline">
              {edition.prints?.name || 'Unknown Artwork'}
            </p>
          )}
          <p
            className={cn(
              'font-mono font-medium group-hover:underline',
              isConfirmed ? 'text-green-700' : 'text-gray-900'
            )}
          >
            {editionLabel}
          </p>
          {(edition.size || edition.frame_type) && (
            <p className="text-sm text-gray-500 truncate">
              {[edition.size, edition.frame_type].filter(Boolean).join(' • ')}
            </p>
          )}
        </button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNotHere(edition)}
        disabled={isSaving || !canMarkUnknown}
        className="shrink-0 text-gray-500 hover:text-amber-700"
        title="Not at this gallery — set location to Unknown"
      >
        <MapPinOff className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Not here</span>
      </Button>
    </div>
  )
}
