'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2, Save, X } from 'lucide-react'
import type { EditionWithRelations } from '@/lib/types'
import { formatDate, calculateNetAmount } from '@/lib/utils'

type Props = {
  edition: EditionWithRelations
  onUpdateNotes: (id: number, notes: string | null) => Promise<boolean>
  colSpan: number
}

export function EditionExpandableRow({ edition, onUpdateNotes, colSpan }: Props) {
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(edition.notes || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveNotes = async () => {
    setIsSaving(true)
    const success = await onUpdateNotes(edition.id, notesValue || null)
    setIsSaving(false)
    if (success) {
      setIsEditingNotes(false)
    }
  }

  const handleCancelNotes = () => {
    setNotesValue(edition.notes || '')
    setIsEditingNotes(false)
  }

  const daysAtLocation = edition.date_in_gallery
    ? Math.floor((Date.now() - new Date(edition.date_in_gallery).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const netRevenue = edition.is_sold && edition.retail_price !== null
    ? calculateNetAmount(edition.retail_price, edition.commission_percentage)
    : null

  return (
    <tr className="bg-gray-50 border-b border-gray-100">
      <td colSpan={colSpan} className="px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Sales Information */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 text-sm border-b border-gray-200 pb-1">
              Sales Information
            </h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Date Sold</dt>
                <dd className="text-gray-900">{edition.date_sold ? formatDate(edition.date_sold) : '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Sale Price</dt>
                <dd className="text-gray-900">
                  {edition.retail_price !== null ? `£${edition.retail_price.toLocaleString()}` : '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Commission</dt>
                <dd className="text-gray-900">
                  {edition.commission_percentage !== null ? `${edition.commission_percentage}%` : '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Net Revenue</dt>
                <dd className="text-gray-900 font-medium">
                  {netRevenue !== null ? `£${netRevenue.toLocaleString()}` : '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Payment Status</dt>
                <dd className={edition.is_settled ? 'text-green-700' : 'text-amber-700'}>
                  {edition.is_sold ? (edition.is_settled ? 'Settled' : 'Pending') : '-'}
                </dd>
              </div>
              {edition.payment_note && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Payment Note</dt>
                  <dd className="text-gray-900">{edition.payment_note}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Gallery Information */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 text-sm border-b border-gray-200 pb-1">
              Location Details
            </h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Current Location</dt>
                <dd className="text-gray-900">{edition.distributors?.name || 'Direct'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Date Arrived</dt>
                <dd className="text-gray-900">
                  {edition.date_in_gallery ? formatDate(edition.date_in_gallery) : '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Days at Location</dt>
                <dd className="text-gray-900">{daysAtLocation !== null ? daysAtLocation : '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Gallery Commission</dt>
                <dd className="text-gray-900">
                  {edition.distributors?.commission_percentage !== null && edition.distributors?.commission_percentage !== undefined
                    ? `${edition.distributors.commission_percentage}%`
                    : '0%'}
                </dd>
              </div>
            </dl>

            {/* Edition Details */}
            <h4 className="font-medium text-gray-900 text-sm border-b border-gray-200 pb-1 mt-4">
              Edition Details
            </h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Edition Number</dt>
                <dd className="text-gray-900">{edition.edition_number || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Variation</dt>
                <dd className="text-gray-900">{edition.variation || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Stock Checked</dt>
                <dd className={edition.is_stock_checked ? 'text-green-700' : 'text-gray-500'}>
                  {edition.is_stock_checked ? 'Yes' : 'No'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1">
              <h4 className="font-medium text-gray-900 text-sm">Notes</h4>
              {!isEditingNotes && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingNotes(true)}
                  className="h-6 px-2 text-xs"
                >
                  Edit
                </Button>
              )}
            </div>
            {isEditingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Add notes..."
                  rows={4}
                  className="text-sm"
                  disabled={isSaving}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelNotes}
                    disabled={isSaving}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {edition.notes || <span className="text-gray-400 italic">No notes</span>}
              </p>
            )}

            {/* Metadata */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <p className="text-xs text-gray-400">
                Created {edition.created_at ? formatDate(edition.created_at) : 'Unknown'}
                {edition.updated_at && ` • Updated ${formatDate(edition.updated_at)}`}
              </p>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}
