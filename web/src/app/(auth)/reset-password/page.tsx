'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { AuthHeader, AuthFooter } from '@/components/auth/auth-header'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
  }

  return (
    <div className="space-y-8">
      <AuthHeader
        icon="lock"
        title="Set new password"
        description="Enter your new password below"
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            New Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="h-11 bg-muted/30 border-border focus:border-accent focus:ring-accent/20"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="confirmPassword"
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Confirm Password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            className="h-11 bg-muted/30 border-border focus:border-accent focus:ring-accent/20"
          />
        </div>

        {error && (
          <Alert variant="destructive">{error}</Alert>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 mt-2 bg-foreground text-background hover:bg-foreground/90 font-medium"
        >
          {loading ? 'Updating...' : 'Update password'}
        </Button>
      </form>

      <AuthFooter />
    </div>
  )
}
