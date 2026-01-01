'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type LoginResult = {
  error?: string
}

function getErrorMessage(error: { message: string; code?: string }): string {
  const message = error.message.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials and try again.'
  }

  if (message.includes('email not confirmed')) {
    return 'Please verify your email address before signing in. Check your inbox for a confirmation link.'
  }

  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'Too many login attempts. Please wait a few minutes before trying again.'
  }

  if (message.includes('user not found')) {
    return 'No account found with this email address.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Unable to connect. Please check your internet connection and try again.'
  }

  if (message.includes('invalid email')) {
    return 'Please enter a valid email address.'
  }

  return error.message
}

export async function login(formData: FormData): Promise<LoginResult> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !email.trim()) {
    return { error: 'Please enter your email address.' }
  }

  if (!password) {
    return { error: 'Please enter your password.' }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
