import assert from 'node:assert/strict'
import test from 'node:test'
import { ASSISTANT_TOOLS, systemPrompt } from './server-agent'

const UNSUPPORTED_STRICT_SCHEMA_KEYS = new Set([
  'maximum',
  'minimum',
  'multipleOf',
  'maxItems',
  'minLength',
  'maxLength',
])

function findUnsupportedKeys(value: unknown, path = 'schema'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findUnsupportedKeys(item, `${path}[${index}]`))
  }
  if (!value || typeof value !== 'object') return []

  return Object.entries(value).flatMap(([key, child]) => [
    ...(UNSUPPORTED_STRICT_SCHEMA_KEYS.has(key) ? [`${path}.${key}`] : []),
    ...findUnsupportedKeys(child, `${path}.${key}`),
  ])
}

test('strict assistant tools use Anthropic-supported JSON Schema constraints', () => {
  const unsupported = ASSISTANT_TOOLS.flatMap((tool) =>
    findUnsupportedKeys(tool.input_schema, tool.name)
  )

  assert.deepEqual(unsupported, [])
})

test('agent investigates database facts and uses the proposal as confirmation', () => {
  const prompt = systemPrompt({
    timeZone: 'Europe/London',
    role: 'editor',
    pendingPreview: null,
    hasImage: false,
  })

  assert.match(prompt, /Never ask the user for current location/)
  assert.match(prompt, /use today's local date as date_in_gallery/)
  assert.match(prompt, /ask for all of it in one short, focused question/)
  assert.match(prompt, /Do not ask the user to confirm your interpretation/)
  assert.match(prompt, /the proposal card is the confirmation step/)
  assert.match(prompt, /using the exact app_path or related \*_app_path returned by a tool/)
  assert.match(prompt, /Never construct, alter, or guess an internal path/)
})
