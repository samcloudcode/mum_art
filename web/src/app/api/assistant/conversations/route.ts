import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AssistantConversationSummary } from '@/lib/assistant/types'

type ConversationRow = {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('assistant_conversations')
    .select('id,title,created_at,updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: 'Could not load assistant conversations' }, { status: 500 })
  }

  const conversations: AssistantConversationSummary[] = ((data ?? []) as ConversationRow[]).map(
    (conversation) => ({
      id: conversation.id,
      title: conversation.title?.trim() || 'Untitled conversation',
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    })
  )

  return NextResponse.json(
    { conversations },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
