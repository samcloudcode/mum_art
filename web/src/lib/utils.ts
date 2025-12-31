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
