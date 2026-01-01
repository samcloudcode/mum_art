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
