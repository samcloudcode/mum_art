'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { AuthHeader, AuthFooter } from '@/components/auth/auth-header'
import { ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!email || !email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)

    const supabase = createClient()
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
      <AuthHeader
        icon="email"
        title="Reset password"
        description="Enter your email and we'll send you a reset link"
      />

      {success && (
        <Alert variant="success">
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>
            We&apos;ve sent a password reset link to {email}.
            The link will expire in 24 hours.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">{error}</Alert>
      )}

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

      <Link
        href="/login"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to login
      </Link>

      <AuthFooter />
    </div>
  )
}
