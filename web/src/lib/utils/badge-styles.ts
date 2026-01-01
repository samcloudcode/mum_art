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
 * Get the appropriate edition status style based on edition state
 */
export function getEditionStatusStyle(edition: {
  is_sold: boolean | null
  is_printed: boolean | null
}) {
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
}): 'Sold' | 'Printed' | 'Not Printed' {
  if (edition.is_sold) return 'Sold'
  if (edition.is_printed) return 'Printed'
  return 'Not Printed'
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
