/**
 * Centralized badge and status styling
 *
 * This file provides consistent colors for all status indicators across the app.
 * Use these styles instead of hardcoding colors in components.
 */

// =============================================================================
// Edition Status Styles
// =============================================================================

export const editionStatusStyles = {
  sold: {
    badge: 'bg-green-100 text-green-800 hover:bg-green-100',
    dot: 'bg-green-500',
  },
  printed: {
    badge: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    dot: 'bg-blue-500',
  },
  not_printed: {
    badge: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
    dot: 'bg-gray-400',
  },
} as const

// =============================================================================
// Payment Status Styles
// =============================================================================

export const paymentStatusStyles = {
  paid: {
    badge: 'bg-green-100 text-green-800 hover:bg-green-100',
    dot: 'bg-green-500',
  },
  unpaid: {
    badge: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
    dot: 'bg-amber-500',
  },
} as const

// =============================================================================
// Save Feedback Styles
// =============================================================================

export const feedbackStyles = {
  saved: 'bg-green-100',
  error: 'bg-red-100',
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
