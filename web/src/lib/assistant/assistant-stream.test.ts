import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AssistantStreamError,
  encodeAssistantStreamEvent,
  readAssistantStream,
  type AssistantStreamEvent,
  type AssistantTurnResponse,
} from './assistant-stream'

const turn: AssistantTurnResponse = {
  conversationId: '10000000-0000-4000-8000-000000000001',
  userMessage: {
    id: '10000000-0000-4000-8000-000000000002',
    role: 'user',
    content: 'Compare this year with last year',
    createdAt: '2026-09-01T10:00:00.000Z',
  },
  assistantMessage: {
    id: '10000000-0000-4000-8000-000000000003',
    role: 'assistant',
    content: 'This year is ahead of the same period last year.',
    createdAt: '2026-09-01T10:00:12.000Z',
  },
  proposal: null,
}

function chunkedStream(events: AssistantStreamEvent[], chunkSizes: number[]): ReadableStream<Uint8Array> {
  const encoded = events.map(encodeAssistantStreamEvent)
  const length = encoded.reduce((total, value) => total + value.length, 0)
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const value of encoded) {
    bytes.set(value, offset)
    offset += value.length
  }

  return new ReadableStream({
    start(controller) {
      let position = 0
      let chunkIndex = 0
      while (position < bytes.length) {
        const chunkSize = chunkSizes[chunkIndex % chunkSizes.length]
        controller.enqueue(bytes.slice(position, position + chunkSize))
        position += chunkSize
        chunkIndex += 1
      }
      controller.close()
    },
  })
}

test('reads progress and terminal payloads across arbitrary byte boundaries', async () => {
  const progressEvents: string[] = []
  const result = await readAssistantStream(
    chunkedStream([
      { type: 'progress', progress: 'understanding' },
      { type: 'progress', progress: 'sales' },
      { type: 'progress', progress: 'salesComparison' },
      { type: 'complete', turn },
    ], [1, 2, 5, 3]),
    (progress) => progressEvents.push(progress)
  )

  assert.deepEqual(progressEvents, ['understanding', 'sales', 'salesComparison'])
  assert.deepEqual(result, turn)
})

test('progress replaces one transient value without becoming a conversation message', async () => {
  const persistedMessages = [turn.userMessage]
  let currentProgress: string | null = null

  const completed = await readAssistantStream(
    chunkedStream([
      { type: 'progress', progress: 'stock' },
      { type: 'progress', progress: 'editionDetails' },
      { type: 'complete', turn },
    ], [7]),
    (progress) => {
      currentProgress = progress
    }
  )
  persistedMessages.push(completed.assistantMessage)

  assert.equal(currentProgress, 'editionDetails')
  assert.deepEqual(persistedMessages, [turn.userMessage, turn.assistantMessage])
  assert.equal(
    persistedMessages.some((message) => /Checking current stock|Checking edition details/.test(message.content)),
    false
  )
})

test('preserves a pending proposal in the terminal success payload', async () => {
  const turnWithProposal: AssistantTurnResponse = {
    ...turn,
    proposal: {
      id: '10000000-0000-4000-8000-000000000004',
      status: 'pending',
      expiresAt: '2026-09-01T10:15:00.000Z',
      appliedAt: null,
      preview: {
        summary: '1 edition: move stock',
        warnings: [],
        editions: [],
      },
    },
  }

  const completed = await readAssistantStream(
    chunkedStream([{ type: 'complete', turn: turnWithProposal }], [2, 11, 1]),
    () => undefined
  )

  assert.deepEqual(completed.proposal, turnWithProposal.proposal)
  assert.equal(completed.proposal?.status, 'pending')
})

test('surfaces explicit terminal stream errors without provider details', async () => {
  await assert.rejects(
    readAssistantStream(
      chunkedStream([
        { type: 'progress', progress: 'answer' },
        {
          type: 'error',
          code: 'assistant_unavailable',
          error: 'The assistant is temporarily unavailable. No inventory was changed.',
        },
      ], [4, 1, 9]),
      () => undefined
    ),
    (error: unknown) => {
      assert.ok(error instanceof AssistantStreamError)
      assert.equal(error.code, 'assistant_unavailable')
      assert.match(error.message, /No inventory was changed/)
      return true
    }
  )
})

test('rejects unrecognised progress values rather than displaying server data', async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"type":"progress","progress":"raw_tool_input"}\n'))
      controller.close()
    },
  })

  await assert.rejects(readAssistantStream(body, () => undefined), /could not be read/)
})
