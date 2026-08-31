import { NextRequest, NextResponse } from 'next/server'
import { getAssistantCatalogueReference } from '@/lib/assistant/server-inventory'
import {
  TranscriptionProviderError,
  transcribeInventoryAudio,
  transcriptionFileName,
} from '@/lib/assistant/transcription'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_AUDIO_BYTES = 6 * 1024 * 1024
const AUDIO_TYPES = new Set([
  'audio/mp4',
  'video/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'video/webm',
])

function providerErrorResponse(error: TranscriptionProviderError) {
  if (error.status === 422) {
    return { status: 422, error: 'I could not hear any speech in that recording. Please try again.' }
  }
  if (error.status === 429) {
    return { status: 429, error: 'Voice transcription is busy at the moment. Please wait a minute and try again.' }
  }
  if (error.status === 401 || error.status === 403) {
    return { status: 503, error: 'Voice transcription is not correctly configured. Please ask an administrator to check it.' }
  }
  if (error.status && error.status >= 400 && error.status < 500) {
    return { status: 502, error: 'The transcription service could not process that recording. Please record it again.' }
  }
  return { status: 503, error: 'Voice transcription is temporarily unavailable. Please try again or type the request.' }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Voice transcription is not configured yet. You can still type your request.' },
      { status: 503 }
    )
  }

  let audio: File | null = null
  try {
    const form = await request.formData()
    const value = form.get('audio')
    audio = value instanceof File && value.size > 0 ? value : null
  } catch {
    return NextResponse.json({ error: 'The recording could not be read. Please try again.' }, { status: 400 })
  }

  if (!audio) return NextResponse.json({ error: 'Please record a voice message first.' }, { status: 400 })
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'The recording is too long. Keep it under one minute.' }, { status: 413 })
  }

  const mimeType = audio.type.split(';')[0].toLowerCase()
  if (!AUDIO_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'This browser produced an unsupported audio format.' }, { status: 415 })
  }

  const providerFile = new File([await audio.arrayBuffer()], transcriptionFileName(mimeType), {
    type: mimeType,
  })
  const catalogue = await getAssistantCatalogueReference(supabase).catch(() => null)

  try {
    const transcript = await transcribeInventoryAudio({ apiKey, audio: providerFile, catalogue })
    return NextResponse.json(
      { transcript },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    const providerError = error instanceof TranscriptionProviderError
      ? error
      : new TranscriptionProviderError('Unexpected transcription error', { cause: error })
    const response = providerErrorResponse(providerError)
    console.error('Voice transcription failed', {
      name: providerError.name,
      status: providerError.status,
      requestId: providerError.requestId,
    })
    return NextResponse.json(
      { error: response.error, reference: providerError.requestId },
      { status: response.status }
    )
  }
}
