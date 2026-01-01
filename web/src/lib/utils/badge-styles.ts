/**
 * Centralized badge and status styling
 *
 * This file provides consistent colors for all status indicators across the app.
 * Uses the coastal palette (--seafoam, --coral, --gold, --accent) for a
 * gallery catalog aesthetic.
 */

// =============================================================================
// Edition Status Styles - Coastal Palette
// =============================================================================

export const editionStatusStyles = {
  sold: {
    badge: 'bg-seafoam/15 text-seafoam border border-seafoam/30',
    dot: 'bg-seafoam',
  },
  printed: {
    badge: 'bg-accent/10 text-accent border border-accent/20',
    dot: 'bg-accent',
  },
  not_printed: {
    badge: 'bg-muted text-muted-foreground border border-border',
    dot: 'bg-muted-foreground/50',
  },
  unknown: {
    badge: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
    dot: 'bg-amber-500',
  },
} as const

// =============================================================================
// Status Confidence Styles
// =============================================================================

export const statusConfidenceStyles = {
  verified: {
    badge: 'bg-green-100 text-green-800 hover:bg-green-100',
    dot: 'bg-green-500',
  },
  unverified: {
    badge: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    dot: 'bg-yellow-500',
  },
  legacy_unknown: {
    badge: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
    dot: 'bg-amber-500',
  },
} as const

// =============================================================================
// Payment Status Styles - Coastal Palette
// =============================================================================

export const paymentStatusStyles = {
  paid: {
    badge: 'bg-seafoam/15 text-seafoam border border-seafoam/30',
    dot: 'bg-seafoam',
  },
  unpaid: {
    badge: 'bg-coral/15 text-coral border border-coral/30',
    dot: 'bg-coral',
  },
} as const

// =============================================================================
// Sale Status Styles - Coastal Palette
// =============================================================================

export const saleStatusStyles = {
  unsold: {
    badge: 'bg-muted text-muted-foreground border border-border',
    dot: 'bg-muted-foreground/50',
  },
  sold: {
    badge: 'bg-gold/15 text-gold border border-gold/30',
    dot: 'bg-gold',
  },
  settled: {
    badge: 'bg-seafoam/15 text-seafoam border border-seafoam/30',
    dot: 'bg-seafoam',
  },
} as const

// =============================================================================
// Save Feedback Styles
// =============================================================================

export const feedbackStyles = {
  saved: 'bg-seafoam/10',
  error: 'bg-coral/10',
} as const

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an edition has unknown/legacy status
 */
export function isLegacyUnknown(edition: {
  status_confidence?: 'verified' | 'unverified' | 'legacy_unknown' | null
}): boolean {
  return edition.status_confidence === 'legacy_unknown'
}

/**
 * Get the appropriate edition status style based on edition state
 */
export function getEditionStatusStyle(edition: {
  is_sold: boolean | null
  is_printed: boolean | null
  status_confidence?: 'verified' | 'unverified' | 'legacy_unknown' | null
}) {
  // Legacy/unknown editions get a distinct style
  if (edition.status_confidence === 'legacy_unknown') return editionStatusStyles.unknown
  if (edition.is_sold) return editionStatusStyles.sold
  if (edition.is_printed) return editionStatusStyles.printed
  return editionStatusStyles.not_printed
}

/**
 * Get the appropriate edition status label
 */
export function getEditionStatusLabel(edition: {
  is_sold: boolean | null
  is_printed: boolean | null
  status_confidence?: 'verified' | 'unverified' | 'legacy_unknown' | null
}): 'Sold' | 'Printed' | 'Not Printed' | 'Unknown' {
  // Legacy/unknown editions show as "Unknown"
  if (edition.status_confidence === 'legacy_unknown') return 'Unknown'
  if (edition.is_sold) return 'Sold'
  if (edition.is_printed) return 'Printed'
  return 'Not Printed'
}

/**
 * Get the status confidence style
 */
export function getStatusConfidenceStyle(
  confidence: 'verified' | 'unverified' | 'legacy_unknown' | null | undefined
) {
  return statusConfidenceStyles[confidence || 'verified']
}

/**
 * Get the status confidence label
 */
export function getStatusConfidenceLabel(
  confidence: 'verified' | 'unverified' | 'legacy_unknown' | null | undefined
): 'Verified' | 'Unverified' | 'Legacy Unknown' {
  switch (confidence) {
    case 'unverified':
      return 'Unverified'
    case 'legacy_unknown':
      return 'Legacy Unknown'
    default:
      return 'Verified'
  }
}

/**
 * Get the payment status style
 */
export function getPaymentStatusStyle(isSettled: boolean) {
  return isSettled ? paymentStatusStyles.paid : paymentStatusStyles.unpaid
}

/**
 * Get the payment status label
 */
export function getPaymentStatusLabel(isSettled: boolean): 'Paid' | 'Unpaid' {
  return isSettled ? 'Paid' : 'Unpaid'
}
