import type { AssistantCatalogueReference } from './server-inventory'

const MAX_KEYWORDS = 100
const TRANSCRIPTION_PROMPT =
  'British English inventory dictation about fine-art prints, numbered editions, artist proofs, galleries, stock checks, printing, sales, and moving stock. Preserve artwork and gallery names, abbreviations, edition numbers, prices, and dates exactly.'

export class TranscriptionProviderError extends Error {
  status?: number
  requestId?: string

  constructor(message: string, options?: { status?: number; requestId?: string; cause?: unknown }) {
    super(message, { cause: options?.cause })
    this.name = 'TranscriptionProviderError'
    this.status = options?.status
    this.requestId = options?.requestId
  }
}

export function inventoryTranscriptionKeywords(
  artworks: Array<{ name: string; short_name?: string | null }>,
  locations: Array<{ name: string }>
): string[] {
  return [...new Set([
    'artist proof',
    'edition',
    'gallery',
    'stock check',
    ...locations.map((location) => location.name),
    ...artworks.flatMap((artwork) => [artwork.name, artwork.short_name ?? '']),
  ].map((term) => term.trim()).filter((term) => term && !/[<>\r\n]/.test(term)))].slice(0, MAX_KEYWORDS)
}

export function transcriptionFileName(mimeType: string): string {
  switch (mimeType.split(';')[0].toLowerCase()) {
    case 'audio/mp4':
    case 'video/mp4':
      return 'dictation.mp4'
    case 'audio/mpeg':
      return 'dictation.mp3'
    case 'audio/wav':
    case 'audio/x-wav':
      return 'dictation.wav'
    default:
      return 'dictation.webm'
  }
}

export async function transcribeInventoryAudio({
  apiKey,
  audio,
  catalogue,
  fetcher = fetch,
}: {
  apiKey: string
  audio: File
  catalogue: AssistantCatalogueReference | null
  fetcher?: typeof fetch
}): Promise<string> {
  const body = new FormData()
  body.set('model', 'gpt-transcribe')
  body.set('file', audio)
  body.set('prompt', TRANSCRIPTION_PROMPT)
  body.append('languages[]', 'en')

  if (catalogue) {
    const keywords = inventoryTranscriptionKeywords(catalogue.artworks, catalogue.locations)
    for (const keyword of keywords) body.append('keywords[]', keyword)
  }

  let response: Response
  try {
    response = await fetcher('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
      signal: AbortSignal.timeout(55_000),
    })
  } catch (error) {
    throw new TranscriptionProviderError('Could not reach the transcription service', { cause: error })
  }

  const requestId = response.headers.get('x-request-id') ?? undefined
  if (!response.ok) {
    throw new TranscriptionProviderError('The transcription service rejected the recording', {
      status: response.status,
      requestId,
    })
  }

  let data: unknown
  try {
    data = await response.json()
  } catch (error) {
    throw new TranscriptionProviderError('The transcription service returned an invalid response', {
      status: 502,
      requestId,
      cause: error,
    })
  }

  const transcript = data && typeof data === 'object' && 'text' in data && typeof data.text === 'string'
    ? data.text.trim()
    : ''
  if (!transcript) {
    throw new TranscriptionProviderError('No speech was recognised', { status: 422, requestId })
  }
  return transcript
}
