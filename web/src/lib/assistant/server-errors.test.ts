import assert from 'node:assert/strict'
import test from 'node:test'
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk'
import { assistantErrorDetails, assistantErrorResponse } from './server-errors'

function apiError(status: number, name = 'APIError') {
  return Object.assign(new Error('Provider details must stay server-side'), {
    name,
    status,
    requestID: 'request-reference',
  })
}

test('assistant errors give safe, actionable feedback without provider details', () => {
  const rejected = assistantErrorResponse(apiError(400))
  assert.equal(rejected.code, 'assistant_request_rejected')
  assert.match(rejected.error, /No inventory was changed/)
  assert.doesNotMatch(rejected.error, /Provider details/)

  const busy = assistantErrorResponse(apiError(429))
  assert.equal(busy.status, 429)
  assert.match(busy.error, /wait a minute/i)

  const unavailable = assistantErrorResponse(apiError(503))
  assert.equal(unavailable.code, 'assistant_unavailable')
  assert.match(unavailable.error, /temporarily unavailable/i)

  const timeout = assistantErrorResponse(new APIConnectionTimeoutError())
  assert.equal(timeout.code, 'assistant_timeout')
  assert.match(timeout.error, /little narrower/i)
})

test('assistant error logs retain a provider request reference', () => {
  assert.equal(assistantErrorDetails(apiError(400)).requestId, 'request-reference')
})
