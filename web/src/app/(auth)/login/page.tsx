'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from './actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setLoading(true)

    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, the server action redirects automatically
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
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>
          <span className="font-serif text-xl tracking-tight text-foreground">
            Sue Stitt Art
          </span>
        </div>
        <h1 className="text-foreground">Welcome back</h1>
        <p className="text-muted-foreground">
          Sign in to manage your print inventory
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-md bg-red-50 border border-red-200 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Login form */}
      <form action={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            disabled={loading}
            className="h-11 bg-muted/30 border-border focus:border-accent focus:ring-accent/20"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
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
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground/60">
        Sue Stitt Art &middot; Collection Manager
      </p>
    </div>
  )
}
