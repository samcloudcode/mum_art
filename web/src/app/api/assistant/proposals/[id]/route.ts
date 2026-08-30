import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('assistant_proposals')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'The proposal could not be dismissed' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'The proposal is no longer pending' }, { status: 409 })
  return NextResponse.json({ ok: true, status: 'rejected' })
}
