import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { draftInventoryProposal, draftUndoProposal } from './server-inventory'
import type { InventoryAction } from './types'

type QueryResult = { data: unknown; error: null }

class FakeQuery implements PromiseLike<QueryResult> {
  private operation: 'select' | 'insert' | 'update' = 'select'
  private payload: Record<string, unknown> | null = null
  private filters = new Map<string, unknown>()

  constructor(
    private table: string,
    private database: FakeDatabase
  ) {}

  select(): this {
    return this
  }

  insert(payload: Record<string, unknown>): this {
    this.operation = 'insert'
    this.payload = payload
    return this
  }

  update(payload: Record<string, unknown>): this {
    this.operation = 'update'
    this.payload = payload
    return this
  }

  eq(field: string, value: unknown): this {
    this.filters.set(field, value)
    return this
  }

  in(field: string, value: unknown[]): this {
    this.filters.set(field, value)
    return this
  }

  order(): this {
    return this
  }

  limit(): this {
    return this
  }

  is(field: string, value: unknown): this {
    this.filters.set(field, value)
    return this
  }

  async maybeSingle(): Promise<QueryResult> {
    return this.execute(true)
  }

  async single(): Promise<QueryResult> {
    return this.execute(true)
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute(false)).then(onfulfilled, onrejected)
  }

  private execute(single: boolean): QueryResult {
    if (this.table === 'editions') {
      const ids = this.filters.get('id') as number[] | undefined
      const rows = ids ? this.database.editions.filter((edition) => ids.includes(edition.id)) : this.database.editions
      return { data: rows, error: null }
    }
    if (this.table === 'distributors') {
      return { data: this.database.distributors, error: null }
    }
    if (this.table === 'assistant_proposals' && this.operation === 'insert') {
      this.database.insertedProposal = this.payload
      const proposal = {
        id: '10000000-0000-4000-8000-000000000001',
        status: 'pending',
        preview: this.payload?.preview,
        expires_at: this.payload?.expires_at,
        applied_at: null,
        result: null,
        compiled_changes: this.payload?.compiled_changes,
        reverts_proposal_id: this.payload?.reverts_proposal_id,
      }
      return { data: single ? proposal : [proposal], error: null }
    }
    if (this.table === 'assistant_proposals' && this.operation === 'select') {
      const rows = this.database.appliedProposals.filter((proposal) =>
        [...this.filters].every(([field, value]) => proposal[field] === value)
      )
      return { data: single ? rows[0] ?? null : rows, error: null }
    }
    return { data: null, error: null }
  }
}

class FakeDatabase {
  insertedProposal: Record<string, unknown> | null = null
  appliedProposals: Array<Record<string, unknown>> = []

  distributors = [
    { id: 1, name: 'Direct', commission_percentage: 0, is_active: true, is_favorite: true },
    { id: 2, name: 'Kendalls', commission_percentage: 40, is_active: true, is_favorite: true },
    { id: 3, name: 'Unknown', commission_percentage: null, is_active: true, is_favorite: false },
  ]

  editions = [this.edition()]

  edition(overrides: Record<string, unknown> = {}) {
    return {
      id: 10,
      print_id: 5,
      distributor_id: 1,
      edition_number: 12,
      edition_type: 'numbered',
      edition_display_name: 'Bembridge 12',
      is_printed: false,
      is_sold: false,
      is_settled: false,
      is_stock_checked: false,
      retail_price: null,
      date_sold: null,
      commission_percentage: null,
      date_in_gallery: null,
      size: null,
      frame_type: null,
      status_confidence: 'verified',
      is_active: true,
      updated_at: '2026-08-30T09:00:00.000Z',
      prints: {
        id: 5,
        name: 'Bembridge',
        short_name: 'Bemb',
        total_editions: 350,
        is_active: true,
        is_favorite: true,
      },
      distributors: this.distributors[0],
      ...overrides,
    }
  }

  client(): SupabaseClient {
    return {
      from: (table: string) => new FakeQuery(table, this),
    } as unknown as SupabaseClient
  }
}

async function draft(database: FakeDatabase, actions: InventoryAction[]) {
  return draftInventoryProposal(database.client(), {
    conversationId: '20000000-0000-4000-8000-000000000001',
    userId: '30000000-0000-4000-8000-000000000001',
    requestText: 'test request',
    actions,
    model: 'test-model',
    canWrite: true,
  })
}

test('compiles printing and moving into one exact edition patch', async () => {
  const database = new FakeDatabase()
  const result = await draft(database, [
    { type: 'mark_printed', edition_ids: [10] },
    {
      type: 'move_stock',
      edition_ids: [10],
      distributor_id: 2,
      date_in_gallery: '2026-08-30',
    },
  ])

  assert.equal(result.ok, true)
  assert.equal(result.proposal?.preview.editions.length, 1)
  const stored = database.insertedProposal?.compiled_changes as Array<{
    edition_id: number
    patch: Record<string, unknown>
  }>
  assert.deepEqual(stored, [
    {
      edition_id: 10,
      expected_updated_at: '2026-08-30T09:00:00.000Z',
      patch: {
        is_printed: true,
        distributor_id: 2,
        date_in_gallery: '2026-08-30',
      },
      before: {
        is_printed: false,
        distributor_id: 1,
        date_in_gallery: null,
      },
      action: 'move',
      description: 'Moved to Kendalls and marked as printed',
    },
  ])
})

test('moving between locations clears the previous stock confirmation', async () => {
  const database = new FakeDatabase()
  database.editions = [database.edition({ is_printed: true, is_stock_checked: true })]

  const result = await draft(database, [
    {
      type: 'move_stock',
      edition_ids: [10],
      distributor_id: 2,
      date_in_gallery: '2026-08-30',
    },
  ])

  assert.equal(result.ok, true)
  const stored = database.insertedProposal?.compiled_changes as Array<{ patch: Record<string, unknown> }>
  assert.equal(stored[0].patch.is_stock_checked, false)
})

test('compiles an exact sale with gallery commission and reversible before-values', async () => {
  const database = new FakeDatabase()
  database.editions = [database.edition({
    distributor_id: 2,
    is_printed: true,
    is_stock_checked: true,
    distributors: database.distributors[1],
  })]

  const result = await draft(database, [{
    type: 'mark_sold',
    edition_ids: [10],
    retail_price: 125.5,
    date_sold: '2026-08-30',
  }])

  assert.equal(result.ok, true)
  assert.equal(result.proposal?.undoable, true)
  const stored = database.insertedProposal?.compiled_changes as Array<{
    patch: Record<string, unknown>
    before: Record<string, unknown>
    action: string
  }>
  assert.deepEqual(stored, [{
    edition_id: 10,
    expected_updated_at: '2026-08-30T09:00:00.000Z',
    patch: {
      is_sold: true,
      retail_price: 125.5,
      date_sold: '2026-08-30',
      commission_percentage: 40,
      is_stock_checked: false,
    },
    before: {
      is_sold: false,
      retail_price: null,
      date_sold: null,
      commission_percentage: null,
      is_stock_checked: true,
    },
    action: 'sell',
    description: 'Marked as sold',
  }])
  assert.match(result.proposal?.preview.editions[0].changes.map((change) => change.label).join(','), /Sale price/)
  assert.match(result.proposal?.preview.editions[0].changes.map((change) => change.after).join(','), /£125.50/)
})

test('requires a sale to identify one printed edition', async () => {
  const database = new FakeDatabase()
  const unprinted = await draft(database, [{
    type: 'mark_sold',
    edition_ids: [10],
    retail_price: 100,
    date_sold: '2026-08-30',
  }])
  assert.equal(unprinted.ok, false)
  assert.match(unprinted.error ?? '', /must already be printed/)

  database.editions = [database.edition({ id: 11, is_printed: true }), database.edition({ is_printed: true })]
  const multiple = await draft(database, [{
    type: 'mark_sold',
    edition_ids: [10, 11],
    retail_price: 100,
    date_sold: '2026-08-30',
  }])
  assert.equal(multiple.ok, false)
  assert.match(multiple.error ?? '', /exactly one edition/)
})

test('keeps a sale separate from printing or moving the same edition', async () => {
  const database = new FakeDatabase()
  const printingAndSale = await draft(database, [
    { type: 'mark_printed', edition_ids: [10] },
    {
      type: 'mark_sold',
      edition_ids: [10],
      retail_price: 100,
      date_sold: '2026-08-30',
    },
  ])
  assert.equal(printingAndSale.ok, false)
  assert.match(printingAndSale.error ?? '', /already be printed/)

  database.editions = [database.edition({ is_printed: true })]
  const movingAndSale = await draft(database, [
    {
      type: 'move_stock',
      edition_ids: [10],
      distributor_id: 2,
      date_in_gallery: '2026-08-30',
    },
    {
      type: 'mark_sold',
      edition_ids: [10],
      retail_price: 100,
      date_sold: '2026-08-30',
    },
  ])
  assert.equal(movingAndSale.ok, false)
  assert.match(movingAndSale.error ?? '', /cannot be sold and changed/)

  const duplicateSale = await draft(database, [
    {
      type: 'mark_sold',
      edition_ids: [10],
      retail_price: 100,
      date_sold: '2026-08-30',
    },
    {
      type: 'mark_sold',
      edition_ids: [10],
      retail_price: 125,
      date_sold: '2026-08-31',
    },
  ])
  assert.equal(duplicateSale.ok, false)
  assert.match(duplicateSale.error ?? '', /more than one sale instruction/)
})

test('drafts an undo proposal from captured before-values', async () => {
  const database = new FakeDatabase()
  database.editions = [database.edition({
    distributor_id: 2,
    is_printed: true,
    is_stock_checked: true,
    distributors: database.distributors[1],
  })]
  await draft(database, [{
    type: 'mark_sold',
    edition_ids: [10],
    retail_price: 125.5,
    date_sold: '2026-08-30',
  }])
  const originalCompiled = database.insertedProposal?.compiled_changes
  const originalPreview = database.insertedProposal?.preview
  database.appliedProposals = [{
    id: '40000000-0000-4000-8000-000000000001',
    user_id: '30000000-0000-4000-8000-000000000001',
    conversation_id: '20000000-0000-4000-8000-000000000001',
    status: 'applied',
    preview: originalPreview,
    compiled_changes: originalCompiled,
    reverts_proposal_id: null,
    result: null,
  }]
  database.editions = [database.edition({
    distributor_id: 2,
    is_printed: true,
    is_sold: true,
    is_stock_checked: false,
    retail_price: 125.5,
    date_sold: '2026-08-30',
    commission_percentage: 40,
    updated_at: '2026-08-30T10:00:00.000Z',
    distributors: database.distributors[1],
  })]
  database.insertedProposal = null

  const result = await draftUndoProposal(database.client(), {
    conversationId: '20000000-0000-4000-8000-000000000001',
    userId: '30000000-0000-4000-8000-000000000001',
    requestText: 'undo that',
    model: 'test-model',
    canWrite: true,
  })

  assert.equal(result.ok, true)
  assert.equal(result.proposal?.revertsProposalId, '40000000-0000-4000-8000-000000000001')
  assert.equal(result.proposal?.undoable, false)
  const insertedUndo = database.insertedProposal as unknown as Record<string, unknown>
  const stored = insertedUndo.compiled_changes as Array<{
    patch: Record<string, unknown>
    before: Record<string, unknown>
    action: string
  }>
  assert.deepEqual(stored[0].patch, {
    is_sold: false,
    retail_price: null,
    date_sold: null,
    commission_percentage: null,
    is_stock_checked: true,
  })
  assert.deepEqual(stored[0].before, {
    is_sold: true,
    retail_price: 125.5,
    date_sold: '2026-08-30',
    commission_percentage: 40,
    is_stock_checked: false,
  })
  assert.equal(stored[0].action, 'undo')
})

test('refuses undo when a relevant field changed afterwards', async () => {
  const database = new FakeDatabase()
  database.appliedProposals = [{
    id: '40000000-0000-4000-8000-000000000001',
    user_id: '30000000-0000-4000-8000-000000000001',
    conversation_id: '20000000-0000-4000-8000-000000000001',
    status: 'applied',
    preview: { summary: '1 edition: mark as sold', editions: [], warnings: [] },
    compiled_changes: [{
      edition_id: 10,
      patch: { is_sold: true, retail_price: 125.5 },
      before: { is_sold: false, retail_price: null },
      description: 'Marked as sold',
    }],
    reverts_proposal_id: null,
    result: null,
  }]
  database.editions = [database.edition({
    is_printed: true,
    is_sold: true,
    retail_price: 150,
  })]

  const result = await draftUndoProposal(database.client(), {
    conversationId: '20000000-0000-4000-8000-000000000001',
    userId: '30000000-0000-4000-8000-000000000001',
    requestText: 'undo that',
    model: 'test-model',
    canWrite: true,
  })

  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /Sale price is different/)
  assert.equal(database.insertedProposal, null)
})

test('rejects contradictory present and missing instructions', async () => {
  const database = new FakeDatabase()
  database.editions = [database.edition({ is_printed: true })]

  const result = await draft(database, [
    { type: 'confirm_stock_present', edition_ids: [10], distributor_id: 1 },
    { type: 'report_stock_missing', edition_ids: [10], distributor_id: 1 },
  ])

  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /both present and missing/)
  assert.equal(database.insertedProposal, null)
})

test('rejects changes to sold editions', async () => {
  const database = new FakeDatabase()
  database.editions = [database.edition({ is_printed: true, is_sold: true })]

  const result = await draft(database, [{ type: 'mark_printed', edition_ids: [10] }])

  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /recorded as sold/)
  assert.equal(database.insertedProposal, null)
})
