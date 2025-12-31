'use client'

import { Badge } from '@/components/ui/badge'
import {
  editionStatusStyles,
  paymentStatusStyles,
  getEditionStatusStyle,
  getEditionStatusLabel,
} from '@/lib/utils/badge-styles'
import type { EditionWithRelations } from '@/lib/types'

type Props = {
  edition: EditionWithRelations
  showUnpaid?: boolean
}

export function EditionStatusBadges({ edition, showUnpaid = true }: Props) {
  const statusStyle = getEditionStatusStyle(edition)
  const statusLabel = getEditionStatusLabel(edition)

  return (
    <div className="flex gap-1 flex-wrap">
      <Badge className={statusStyle.badge}>{statusLabel}</Badge>
      {showUnpaid && edition.is_sold && !edition.is_settled && (
        <Badge className={paymentStatusStyles.unpaid.badge}>Unpaid</Badge>
      )}
    </div>
  )
}

export function EditionStatusBadge({
  status,
}: {
  status: 'sold' | 'printed' | 'not_printed' | 'unpaid'
}) {
  switch (status) {
    case 'sold':
      return <Badge className={editionStatusStyles.sold.badge}>Sold</Badge>
    case 'printed':
      return <Badge className={editionStatusStyles.printed.badge}>Printed</Badge>
    case 'not_printed':
      return <Badge className={editionStatusStyles.not_printed.badge}>Not Printed</Badge>
    case 'unpaid':
      return <Badge className={paymentStatusStyles.unpaid.badge}>Unpaid</Badge>
  }
}
