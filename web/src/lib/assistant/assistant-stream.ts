import type { AssistantMessage, AssistantProposal } from './types'

export const ASSISTANT_PROGRESS_TEXT = {
  understanding: 'Understanding your request…',
  catalogue: 'Checking the catalogue…',
  sales: 'Checking sales records…',
  salesComparison: 'Comparing sales periods…',
  stock: 'Checking current stock…',
  editionDetails: 'Checking edition details…',
  history: 'Reviewing recent changes…',
  proposal: 'Preparing proposed changes—nothing has changed yet…',
  proposalDismissal: 'Dismissing the proposal—inventory has not changed…',
  answer: 'Preparing your answer…',
} as const

export type AssistantProgress = keyof typeof ASSISTANT_PROGRESS_TEXT

export type AssistantTurnResponse = {
  conversationId: string
  userMessage: AssistantMessage
  assistantMessage: AssistantMessage
  proposal: AssistantProposal | null
}

export type AssistantStreamEvent =
  | { type: 'progress'; progress: AssistantProgress }
  | { type: 'complete'; turn: AssistantTurnResponse }
  | { type: 'error'; error: string; code?: string }

const PROGRESS_VALUES = new Set<AssistantProgress>(
  Object.keys(ASSISTANT_PROGRESS_TEXT) as AssistantProgress[]
)

const STREAM_READ_ERROR = 'The assistant response could not be read. No inventory was changed. Please try again.'

export class AssistantStreamError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'AssistantStreamError'
    this.code = code
  }
}

export function encodeAssistantStreamEvent(event: AssistantStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`)
}

function isAssistantMessage(value: unknown): value is AssistantMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return typeof message.id === 'string'
    && (message.role === 'user' || message.role === 'assistant')
    && typeof message.content === 'string'
    && typeof message.createdAt === 'string'
}

function isAssistantTurn(value: unknown): value is AssistantTurnResponse {
  if (!value || typeof value !== 'object') return false
  const turn = value as Record<string, unknown>
  return typeof turn.conversationId === 'string'
    && isAssistantMessage(turn.userMessage)
    && isAssistantMessage(turn.assistantMessage)
    && (turn.proposal === null || Boolean(turn.proposal && typeof turn.proposal === 'object'))
}

function eventFromLine(line: string): AssistantStreamEvent {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    throw new AssistantStreamError(STREAM_READ_ERROR)
  }

  if (!value || typeof value !== 'object' || !('type' in value)) {
    throw new AssistantStreamError(STREAM_READ_ERROR)
  }
  const event = value as Record<string, unknown>
  if (event.type === 'progress' && typeof event.progress === 'string'
    && PROGRESS_VALUES.has(event.progress as AssistantProgress)) {
    return event as AssistantStreamEvent
  }
  if (event.type === 'complete' && isAssistantTurn(event.turn)) {
    return event as AssistantStreamEvent
  }
  if (event.type === 'error' && typeof event.error === 'string'
    && (event.code === undefined || typeof event.code === 'string')) {
    return event as AssistantStreamEvent
  }
  throw new AssistantStreamError(STREAM_READ_ERROR)
}

export async function readAssistantStream(
  body: ReadableStream<Uint8Array> | null,
  onProgress: (progress: AssistantProgress) => void
): Promise<AssistantTurnResponse> {
  if (!body) throw new AssistantStreamError(STREAM_READ_ERROR)

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let terminalEvent: Extract<AssistantStreamEvent, { type: 'complete' | 'error' }> | null = null

  const readLine = (line: string) => {
    if (!line.trim()) return
    if (terminalEvent) throw new AssistantStreamError(STREAM_READ_ERROR)
    const event = eventFromLine(line)
    if (event.type === 'progress') {
      onProgress(event.progress)
    } else {
      terminalEvent = event
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      lines.forEach(readLine)
    }
    buffer += decoder.decode()
    if (buffer) readLine(buffer)
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }

  const terminal = terminalEvent as Extract<
    AssistantStreamEvent,
    { type: 'complete' | 'error' }
  > | null
  if (!terminal) throw new AssistantStreamError(STREAM_READ_ERROR)
  if (terminal.type === 'error') {
    throw new AssistantStreamError(terminal.error, terminal.code)
  }
  return terminal.turn
}
