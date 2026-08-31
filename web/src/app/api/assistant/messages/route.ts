import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runProposalAgent, type AgentImage } from '@/lib/assistant/server-agent'
import { assistantErrorDetails, assistantErrorResponse } from '@/lib/assistant/server-errors'
import { toAssistantProposal } from '@/lib/assistant/server-inventory'
import type {
  AssistantConversationResponse,
  AssistantMessage,
  AssistantProposal,
  ProposalPreview,
} from '@/lib/assistant/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_MESSAGE_LENGTH = 4_000
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const IMAGE_TYPES = new Set<AgentImage['mediaType']>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

type MessageRow = {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

type ProposalRow = {
  id: string
  status: AssistantProposal['status']
  preview: ProposalPreview
  expires_at: string
  applied_at: string | null
  result: Record<string, unknown> | null
  compiled_changes: unknown
  reverts_proposal_id: string | null
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function messageFromRow(row: MessageRow): AssistantMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }
}

async function authenticated() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

async function readProposal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  userId: string
): Promise<AssistantProposal | null> {
  const { data } = await supabase
    .from('assistant_proposals')
    .select('id,status,preview,expires_at,applied_at,result,compiled_changes,reverts_proposal_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? toAssistantProposal(data as unknown as ProposalRow) : null
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await authenticated()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const conversationId = request.nextUrl.searchParams.get('conversationId')
  if (!conversationId || !validUuid(conversationId)) {
    return NextResponse.json({ error: 'A valid conversation is required' }, { status: 400 })
  }

  const { data: conversation, error: conversationError } = await supabase
    .from('assistant_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (conversationError) {
    return NextResponse.json({ error: 'Assistant storage is not set up' }, { status: 503 })
  }
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const { data: rows, error } = await supabase
    .from('assistant_messages')
    .select('id,role,content,created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .order('created_at')
    .limit(100)
  if (error) return NextResponse.json({ error: 'Could not load this conversation' }, { status: 500 })

  const response: AssistantConversationResponse = {
    conversationId,
    messages: ((rows ?? []) as unknown as MessageRow[]).map(messageFromRow),
    proposal: await readProposal(supabase, conversationId, user.id),
  }
  return NextResponse.json(response)
}

async function parseRequest(request: NextRequest): Promise<{
  message: string
  conversationId?: string
  image?: AgentImage
}> {
  const contentType = request.headers.get('content-type') ?? ''
  let message = ''
  let conversationId: string | undefined
  let imageFile: File | null = null

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    message = typeof form.get('message') === 'string' ? String(form.get('message')) : ''
    const conversation = form.get('conversationId')
    conversationId = typeof conversation === 'string' && conversation ? conversation : undefined
    const image = form.get('image')
    imageFile = image instanceof File && image.size > 0 ? image : null
  } else {
    const body = (await request.json()) as { message?: unknown; conversationId?: unknown }
    message = typeof body.message === 'string' ? body.message : ''
    conversationId = typeof body.conversationId === 'string' ? body.conversationId : undefined
  }

  message = message.trim()
  if (!message && imageFile) {
    message = 'Read this handwritten inventory note, check each legible entry against the current records, and tell me about discrepancies or possible changes.'
  }
  if (!message) throw new Error('Please enter a request or attach an inventory photo')
  if (message.length > MAX_MESSAGE_LENGTH) throw new Error('The request is too long')
  if (conversationId && !validUuid(conversationId)) throw new Error('The conversation ID is invalid')

  let image: AgentImage | undefined
  if (imageFile) {
    if (imageFile.size > MAX_IMAGE_BYTES) throw new Error('The photo must be smaller than 4 MB')
    if (!IMAGE_TYPES.has(imageFile.type as AgentImage['mediaType'])) {
      throw new Error('Use a JPEG, PNG, GIF, or WebP photo')
    }
    image = {
      mediaType: imageFile.type as AgentImage['mediaType'],
      data: Buffer.from(await imageFile.arrayBuffer()).toString('base64'),
    }
  }

  return { message, conversationId, image }
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await authenticated()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let parsed: Awaited<ReturnType<typeof parseRequest>>
  try {
    parsed = await parseRequest(request)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    )
  }

  let conversationId = parsed.conversationId
  if (conversationId) {
    const { data } = await supabase
      .from('assistant_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!data) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  } else {
    const { data, error } = await supabase
      .from('assistant_conversations')
      .insert({ user_id: user.id, title: parsed.message.slice(0, 80) })
      .select('id')
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Assistant storage is not set up' }, { status: 503 })
    }
    conversationId = data.id as string
  }

  const storedUserContent = parsed.image
    ? `${parsed.message}\n\n[Inventory photo attached for this turn.]`
    : parsed.message
  const { data: userMessage, error: userMessageError } = await supabase
    .from('assistant_messages')
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'user',
      content: storedUserContent,
    })
    .select('id,role,content,created_at')
    .single()
  if (userMessageError || !userMessage) {
    return NextResponse.json({ error: 'Could not save the message' }, { status: 500 })
  }

  const [{ data: historyRows }, { data: profile }, pendingProposal] = await Promise.all([
    supabase
      .from('assistant_messages')
      .select('role,content,created_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('profiles').select('full_name,role').eq('id', user.id).maybeSingle(),
    readProposal(supabase, conversationId, user.id),
  ])

  const history = ((historyRows ?? []) as unknown as Array<{
    role: 'user' | 'assistant'
    content: string
  }>).reverse()

  try {
    const result = await runProposalAgent({
      supabase,
      conversationId,
      userId: user.id,
      messages: history,
      requestText: parsed.message,
      image: parsed.image,
      displayName: (profile as { full_name?: string | null } | null)?.full_name,
      role: (profile as { role?: string | null } | null)?.role,
      pendingPreview: pendingProposal?.status === 'pending' ? pendingProposal.preview : null,
    })

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from('assistant_messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: result.text,
      })
      .select('id,role,content,created_at')
      .single()
    if (assistantMessageError || !assistantMessage) {
      return NextResponse.json({ error: 'The response could not be saved' }, { status: 500 })
    }

    await supabase
      .from('assistant_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', user.id)

    const latestProposal = await readProposal(supabase, conversationId, user.id)
    return NextResponse.json({
      conversationId,
      userMessage: messageFromRow(userMessage as unknown as MessageRow),
      assistantMessage: messageFromRow(assistantMessage as unknown as MessageRow),
      proposal: latestProposal,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'The assistant is not configured yet') {
      return NextResponse.json(
        {
          error: 'The assistant is not configured yet. No inventory was changed. Please ask an administrator to check its settings.',
          code: 'assistant_not_configured',
        },
        { status: 503 }
      )
    }
    const details = assistantErrorDetails(error)
    const response = assistantErrorResponse(error)
    console.error('Assistant request failed', details)
    return NextResponse.json(
      { error: response.error, code: response.code, reference: details.requestId },
      { status: response.status }
    )
  }
}
