'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!email || !email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm`,
    })

    setLoading(false)

    if (error) {
      if (error.message.toLowerCase().includes('rate limit')) {
        setError('Too many requests. Please wait a few minutes before trying again.')
      } else {
        setError(error.message)
      }
      return
    }

    setSuccess(true)
  }

  return (
    <div className="space-y-8">
      {/* Logo and title */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-sm bg-accent/10 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <span className="font-serif text-xl tracking-tight text-foreground">
            Sue Stitt Art
          </span>
        </div>
        <h1 className="text-foreground">Reset password</h1>
        <p className="text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-start gap-3 p-4 rounded-md bg-green-50 border border-green-200 text-green-800">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-green-700">
              We&apos;ve sent a password reset link to {email}.
              The link will expire in 24 hours.
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-md bg-red-50 border border-red-200 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Form */}
      {!success && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="h-11 bg-muted/30 border-border focus:border-accent focus:ring-accent/20"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-2 bg-foreground text-background hover:bg-foreground/90 font-medium"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>
      )}

      {/* Back to login */}
      <Link
        href="/login"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to login
      </Link>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground/60">
        Sue Stitt Art &middot; Collection Manager
      </p>
    </div>
  )
}
