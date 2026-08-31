import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inventoryTranscriptionKeywords,
  transcribeInventoryAudio,
  transcriptionFileName,
} from './transcription'

test('builds deduplicated transcription keywords from artwork and gallery names', () => {
  const keywords = inventoryTranscriptionKeywords(
    [
      { name: 'Bembridge Harbour', short_name: 'Bemb' },
      { name: 'Bembridge Harbour', short_name: null },
      { name: 'Unsafe\nterm', short_name: null },
    ],
    [{ name: 'Kendalls Fine Art' }]
  )

  assert.ok(keywords.includes('Bembridge Harbour'))
  assert.ok(keywords.includes('Bemb'))
  assert.ok(keywords.includes('Kendalls Fine Art'))
  assert.ok(keywords.includes('artist proof'))
  assert.equal(keywords.filter((term) => term === 'Bembridge Harbour').length, 1)
  assert.ok(!keywords.includes('Unsafe\nterm'))
})

test('uses provider-supported filenames for browser recording formats', () => {
  assert.equal(transcriptionFileName('audio/webm;codecs=opus'), 'dictation.webm')
  assert.equal(transcriptionFileName('audio/mp4'), 'dictation.mp4')
  assert.equal(transcriptionFileName('audio/wav'), 'dictation.wav')
})

test('sends inventory terminology and returns the provider transcript', async () => {
  const requestBodies: FormData[] = []
  const transcript = await transcribeInventoryAudio({
    apiKey: 'test-key',
    audio: new File(['audio'], 'dictation.webm', { type: 'audio/webm' }),
    catalogue: {
      loaded_at: '2026-08-31T12:00:00.000Z',
      artworks: [{ id: 1, name: 'Bembridge Harbour', short_name: 'Bemb' }],
      locations: [{ id: 2, name: 'Kendalls Fine Art', commission_percentage: 40 }],
    },
    fetcher: async (_input, init) => {
      requestBodies.push(init?.body as FormData)
      return Response.json({ text: 'Move Bemb 12 to Kendalls Fine Art.' })
    },
  })

  const requestBody = requestBodies[0]
  assert.equal(transcript, 'Move Bemb 12 to Kendalls Fine Art.')
  assert.equal(requestBody.get('model'), 'gpt-transcribe')
  assert.ok(requestBody.getAll('keywords[]').includes('Bembridge Harbour'))
  assert.ok(requestBody.getAll('keywords[]').includes('Kendalls Fine Art'))
})
