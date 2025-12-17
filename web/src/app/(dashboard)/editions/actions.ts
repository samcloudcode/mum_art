'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markEditionsAsPrinted(editionIds: number[]) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('editions')
    .update({
      is_printed: true,
      updated_at: new Date().toISOString(),
    })
    .in('id', editionIds)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/editions')
  return { success: true, count: editionIds.length }
}

export async function markEditionsAsNotPrinted(editionIds: number[]) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('editions')
    .update({
      is_printed: false,
      updated_at: new Date().toISOString(),
    })
    .in('id', editionIds)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/editions')
  return { success: true, count: editionIds.length }
}

export async function moveEditionsToGallery(
  editionIds: number[],
  distributorId: number,
  dateInGallery?: string
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('editions')
    .update({
      distributor_id: distributorId,
      date_in_gallery: dateInGallery || new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .in('id', editionIds)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/editions')
  revalidatePath('/galleries')
  return { success: true, count: editionIds.length }
}

export async function recordSale(
  editionId: number,
  data: {
    dateSold: string
    retailPrice: number
    commissionPercentage: number
    isSettled?: boolean
    paymentNote?: string
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('editions')
    .update({
      is_sold: true,
      date_sold: data.dateSold,
      retail_price: data.retailPrice,
      commission_percentage: data.commissionPercentage,
      is_settled: data.isSettled || false,
      payment_note: data.paymentNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', editionId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/editions')
  revalidatePath('/sales')
  return { success: true }
}

export async function markSalesAsSettled(editionIds: number[], paymentNote?: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('editions')
    .update({
      is_settled: true,
      payment_note: paymentNote || null,
      updated_at: new Date().toISOString(),
    })
    .in('id', editionIds)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/editions')
  revalidatePath('/sales')
  return { success: true, count: editionIds.length }
}
