import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ApplyProposalResult } from '@/lib/assistant/types'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if ((profile as { role?: string | null } | null)?.role?.toLowerCase() === 'viewer') {
    return NextResponse.json({ error: 'This account has read-only access' }, { status: 403 })
  }

  const { data, error } = await supabase.rpc('apply_assistant_proposal', {
    p_proposal_id: id,
  })
  if (error) {
    return NextResponse.json({ error: 'The proposal could not be applied' }, { status: 400 })
  }

  const result = data as unknown as ApplyProposalResult
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}
