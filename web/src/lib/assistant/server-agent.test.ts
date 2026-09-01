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

function countOptionalParameters(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countOptionalParameters(item), 0)
  }
  if (!value || typeof value !== 'object') return 0

  const schema = value as Record<string, unknown>
  const properties = schema.properties
  const required = new Set(Array.isArray(schema.required) ? schema.required : [])
  const optionalHere = schema.type === 'object' && properties && typeof properties === 'object'
    ? Object.keys(properties).filter((key) => !required.has(key)).length
    : 0

  return optionalHere + Object.values(schema).reduce(
    (total: number, child) => total + countOptionalParameters(child),
    0
  )
}

test('only inventory-writing assistant tools use strict schemas', () => {
  const strictTools = ASSISTANT_TOOLS.filter((tool) => tool.strict === true)

  assert.deepEqual(
    strictTools.map((tool) => tool.name).sort(),
    ['draft_inventory_actions', 'draft_proposal_undo', 'withdraw_pending_proposal']
  )

  const unsupported = strictTools.flatMap((tool) =>
    findUnsupportedKeys(tool.input_schema, tool.name)
  )
  assert.deepEqual(unsupported, [])

  const optionalParameters = strictTools.reduce(
    (total, tool) => total + countOptionalParameters(tool.input_schema),
    0
  )
  assert.ok(optionalParameters <= 24, `strict schemas have ${optionalParameters} optional parameters`)

  const inventorySchema = JSON.stringify(
    strictTools.find((tool) => tool.name === 'draft_inventory_actions')?.input_schema
  )
  assert.match(inventorySchema, /update_physical_details/)
  assert.match(inventorySchema, /"size".*"Small","Large","Extra Large"/)
  assert.match(inventorySchema, /"frame_type".*"Framed","Tube only","Mounted"/)
})

test('agent investigates database facts and uses the proposal as confirmation', () => {
  const prompt = systemPrompt({
    timeZone: 'Europe/London',
    role: 'editor',
    pendingPreview: null,
    catalogueReference: {
      loaded_at: '2026-08-31T10:00:00.000Z',
      artworks: [{ id: 5, name: 'Bembridge', short_name: 'Bemb' }],
      locations: [{ id: 2, name: 'Kendalls', commission_percentage: 40 }],
    },
    hasImage: false,
  })

  assert.match(prompt, /Never ask the user for current location/)
  assert.match(prompt, /use today's local date as date_in_gallery/)
  assert.match(prompt, /ask for all of it in one short, focused question/)
  assert.match(prompt, /Do not ask the user to confirm your interpretation/)
  assert.match(prompt, /the proposal card is the confirmation step/)
  assert.match(prompt, /using the exact app navigation path returned by a tool/)
  assert.match(prompt, /These are application navigation routes, not database links/)
  assert.match(prompt, /Trusted application navigation:/)
  assert.match(prompt, /Activity log: \/changelog/)
  assert.match(prompt, /exact unique name or short_name match/)
  assert.match(prompt, /skip find_artworks\/find_locations/)
  assert.match(prompt, /"id":5,"name":"Bembridge","short_name":"Bemb"/)
  assert.match(prompt, /Move:.*draft_inventory_actions with move_stock, which confirms it present at the destination/)
  assert.match(prompt, /Print:.*Include size or frame_type on that action/)
  assert.match(prompt, /size is Small, Large, or Extra Large/)
  assert.match(prompt, /completed move means the user physically handled and placed the edition/)
  assert.match(prompt, /Gallery stock:.*get_gallery_stock.*split confirmed-present from unconfirmed stock/)
  assert.match(prompt, /never say a gallery definitely holds unconfirmed stock/)
  assert.match(prompt, /Sales and sales totals:.*query_sales against date_sold/)
  assert.match(prompt, /What sold at Seaview last month.*query_sales/)
  assert.match(prompt, /Show total sales by gallery and artwork this year.*group_by gallery and artwork/)
  assert.match(prompt, /best-selling prints year to date versus the same period last year.*equal elapsed calendar periods/)
  assert.match(prompt, /today's availability from historical availability/)
  assert.match(prompt, /Review unconfirmed stock at Kendalls.*edition_confirmation=unconfirmed/)
  assert.match(prompt, /edition_order=oldest_in_gallery/)
  assert.match(prompt, /do not propose moving anything until the user identifies it as missing/i)
  assert.match(prompt, /Who marked this edition sold.*get_inventory_history/)
  assert.match(prompt, /Never use inventory history for what sold/)
  assert.match(prompt, /Record a sale:.*draft_inventory_actions with mark_sold/)
})
