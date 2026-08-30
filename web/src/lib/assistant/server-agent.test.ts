import assert from 'node:assert/strict'
import test from 'node:test'
import { ASSISTANT_TOOLS } from './server-agent'

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
