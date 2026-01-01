'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from './actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { AuthHeader, AuthFooter } from '@/components/auth/auth-header'

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
  }

  return (
    <div className="space-y-8">
      <AuthHeader
        icon="gallery"
        title="Welcome back"
        description="Sign in to manage your print inventory"
      />

      {error && (
        <Alert variant="destructive">{error}</Alert>
      )}

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

      <AuthFooter />
    </div>
  )
}
