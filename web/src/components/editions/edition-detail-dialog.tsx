'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2 } from 'lucide-react'
import { calculateNetAmount, formatDate, formatPrice, isArtistProof } from '@/lib/utils'
import type { ActivityLog, EditionWithRelations } from '@/lib/types'

type Props = {
  edition: EditionWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const HISTORY_LIMIT = 25

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right text-foreground break-words">{value ?? '-'}</dd>
    </div>
  )
}

function text(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? '-' : String(value)
}

/** Dates are shown as stored where they can't be parsed — a five-digit year is
 *  itself the thing worth seeing, not something to hide behind "Invalid Date". */
function safeDate(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? `${value} (unparseable)` : formatDate(value)
}

/** One activity_log row as a sentence: field, old -> new, who, when. */
function describeChange(entry: ActivityLog): string {
  if (entry.field_name) {
    const from = entry.old_value === null || entry.old_value === '' ? 'empty' : entry.old_value
    const to = entry.new_value === null || entry.new_value === '' ? 'empty' : entry.new_value
    return `${entry.field_name}: ${from} → ${to}`
  }
  return entry.description || entry.action
}

export function EditionDetailDialog({ edition, open, onOpenChange }: Props) {
  const [history, setHistory] = useState<ActivityLog[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  // Stamped once when this dialog mounts rather than read during render. The
  // call site keys the component by edition id, so each record gets a fresh
  // stamp and fresh history without an effect resetting state.
  const [openedAt] = useState(() => Date.now())

  const editionId = edition?.id ?? null

  useEffect(() => {
    if (!open || editionId === null) return

    let cancelled = false

    const load = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .eq('entity_type', 'edition')
        .eq('entity_id', editionId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)

      if (cancelled) return
      if (error) {
        setHistoryError(error.message)
        setHistory([])
      } else {
        setHistory((data as ActivityLog[]) || [])
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, editionId])

  if (!edition) return null

  const daysAtLocation =
    edition.date_in_gallery
      ? Math.floor(
          (openedAt - new Date(edition.date_in_gallery).getTime()) / (1000 * 60 * 60 * 24)
        )
      : null

  const netRevenue =
    edition.is_sold && edition.retail_price !== null
      ? calculateNetAmount(edition.retail_price, edition.commission_percentage)
      : null

  const editionLabel = isArtistProof(edition)
    ? `AP ${edition.edition_number ?? '?'}`
    : `${edition.edition_number ?? '?'}/${edition.prints?.total_editions ?? '?'}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-2">
            <span className="font-serif">{edition.prints?.name || 'Unknown Artwork'}</span>
            <span className="font-mono text-base">{editionLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          <section>
            <h4 className="text-sm font-medium border-b pb-1 mb-2">Edition</h4>
            <dl className="text-sm">
              <Row label="Display name" value={text(edition.edition_display_name)} />
              <Row label="Number" value={text(edition.edition_number)} />
              <Row
                label="Type"
                value={isArtistProof(edition) ? "Artist's proof" : text(edition.edition_type)}
              />
              <Row label="Run size" value={text(edition.prints?.total_editions)} />
              <Row label="Size" value={edition.size || 'not measured'} />
              <Row label="Frame" value={text(edition.frame_type)} />
              <Row label="Variation" value={text(edition.variation)} />
              <Row label="Printed" value={edition.is_printed ? 'Yes' : 'No'} />
              <Row label="Confirmed here" value={edition.is_stock_checked ? 'Yes' : 'No'} />
              <Row label="Status confidence" value={text(edition.status_confidence)} />
            </dl>
          </section>

          <section>
            <h4 className="text-sm font-medium border-b pb-1 mb-2">Location</h4>
            <dl className="text-sm">
              <Row label="Current" value={edition.distributors?.name || 'Direct'} />
              <Row label="In gallery from" value={safeDate(edition.date_in_gallery)} />
              <Row label="Days there" value={daysAtLocation ?? '-'} />
              <Row
                label="Commission"
                value={
                  edition.distributors?.commission_percentage != null
                    ? `${edition.distributors.commission_percentage}%`
                    : '0%'
                }
              />
            </dl>

            <h4 className="text-sm font-medium border-b pb-1 mb-2 mt-4">Sale</h4>
            <dl className="text-sm">
              <Row label="Sold" value={edition.is_sold ? 'Yes' : 'No'} />
              <Row label="Date sold" value={safeDate(edition.date_sold)} />
              <Row
                label="Price"
                value={edition.retail_price !== null ? formatPrice(edition.retail_price) : '-'}
              />
              <Row
                label="Commission"
                value={
                  edition.commission_percentage !== null
                    ? `${edition.commission_percentage}%`
                    : '-'
                }
              />
              <Row label="Net" value={netRevenue !== null ? formatPrice(netRevenue) : '-'} />
              <Row
                label="Settled"
                value={edition.is_sold ? (edition.is_settled ? 'Yes' : 'Pending') : '-'}
              />
              <Row label="Payment note" value={text(edition.payment_note)} />
            </dl>
          </section>
        </div>

        <section className="mt-2">
          <h4 className="text-sm font-medium border-b pb-1 mb-2">Notes</h4>
          <p className="text-sm whitespace-pre-wrap text-foreground/80">
            {edition.notes || <span className="text-muted-foreground">No notes</span>}
          </p>
        </section>

        <section>
          <h4 className="text-sm font-medium border-b pb-1 mb-2">
            Recent changes
            {history && history.length === HISTORY_LIMIT && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                latest {HISTORY_LIMIT}
              </span>
            )}
          </h4>

          {history === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history…
            </p>
          ) : historyError ? (
            <p className="text-sm text-amber-700">
              Couldn&apos;t load history: {historyError}
            </p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recorded changes. Only edits made through this app are logged.
            </p>
          ) : (
            <ul className="text-sm divide-y">
              {history.map((entry) => (
                <li key={entry.id} className="py-2 flex flex-wrap justify-between gap-x-4">
                  <span className="text-foreground">{describeChange(entry)}</span>
                  <span className="text-xs text-muted-foreground">
                    {safeDate(entry.created_at)}
                    {entry.user_email ? ` • ${entry.user_email}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            id {edition.id} • created {safeDate(edition.created_at)}
            {edition.updated_at ? ` • updated ${safeDate(edition.updated_at)}` : ''}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/editions/${edition.id}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Full record
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
