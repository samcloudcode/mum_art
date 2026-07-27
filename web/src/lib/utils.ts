import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as GBP currency
 */
export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '-'
  return `£${price.toLocaleString()}`
}

/**
 * Calculate net amount after commission
 */
export function calculateNetAmount(
  retailPrice: number | null | undefined,
  commissionPercentage: number | null | undefined
): number {
  if (!retailPrice) return 0
  const commission = commissionPercentage || 0
  return retailPrice * (1 - commission / 100)
}

/** An artist's proof sits outside the numbered run and never counts toward it. */
export const AP = 'ap'

export function isArtistProof(edition: { edition_type?: string | null }): boolean {
  return edition.edition_type === AP
}

/**
 * The canonical name for an edition — "Ducie - 5", or "Ducie AP 1".
 *
 * This existed in three different forms before: the importer and db/manager.py
 * both produce "Name - N", while the artwork-creation dialog produced
 * "Name N/total", so the app disagreed with itself about what an edition was
 * called depending on how it was created. "Name - N" wins because it matches
 * the several thousand rows already imported; changing those to "N/total"
 * would be a data migration, not a code change.
 */
export function editionDisplayName(
  printName: string,
  editionNumber: number | null | undefined,
  editionType: string | null = 'numbered'
): string {
  const name = printName.trim()
  if (editionType === AP) {
    return editionNumber == null ? `${name} AP` : `${name} AP ${editionNumber}`
  }
  return editionNumber == null ? name : `${name} - ${editionNumber}`
}

/**
 * Sort order for editions of one artwork: the numbered run first in ascending
 * order, then the proofs. Replaces `(a.edition_number || 0) - (b.edition_number || 0)`,
 * which was copy-pasted in three places and coerced a null number to 0, sorting
 * unnumbered rows to the very front.
 */
export function compareEditions(
  a: { edition_number: number | null; edition_type?: string | null },
  b: { edition_number: number | null; edition_type?: string | null }
): number {
  const aProof = isArtistProof(a)
  const bProof = isArtistProof(b)
  if (aProof !== bProof) return aProof ? 1 : -1

  // Nulls last within each group rather than first.
  if (a.edition_number == null) return b.edition_number == null ? 0 : 1
  if (b.edition_number == null) return -1
  return a.edition_number - b.edition_number
}

/**
 * Format a date string for display
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Month names for display
 */
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const

/**
 * Get month name from 1-indexed month number
 */
export function getMonthName(month: number): string {
  return MONTHS[month - 1] || ''
}

/**
 * Get start and end dates for a given month/year
 * Uses UTC to avoid timezone edge cases
 */
export function getMonthDateRange(year: number, month: number): { start: string; end: string } {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0))
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  }
}
