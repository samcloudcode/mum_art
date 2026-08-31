import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  draftInventoryProposal,
  draftUndoProposal,
  findArtworks,
  findDistributors,
  getAssistantCatalogueReference,
  getRecentActivity,
  querySales,
  resolveInventoryEntries,
} from './server-inventory'
import type { InventoryAction } from './types'

type QueryResult = { data: unknown; error: null; count?: number }

class FakeQuery implements PromiseLike<QueryResult> {
  private operation: 'select' | 'insert' | 'update' = 'select'
  private payload: Record<string, unknown> | null = null
  private filters = new Map<string, unknown>()
  private lowerBounds = new Map<string, unknown>()
  private upperBounds = new Map<string, unknown>()
  private rangeBounds: [number, number] | null = null
  private maximum: number | null = null
  private excludeLegacy = false
  private wantsCount = false

  constructor(
    private table: string,
    private database: FakeDatabase
  ) {}

  select(_columns?: string, options?: { count?: string }): this {
    this.wantsCount = options?.count === 'exact'
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

  gte(field: string, value: unknown): this {
    this.lowerBounds.set(field, value)
    return this
  }

  lt(field: string, value: unknown): this {
    this.upperBounds.set(field, value)
    return this
  }

  or(expression: string): this {
    if (expression === 'status_confidence.neq.legacy_unknown,status_confidence.is.null') {
      this.excludeLegacy = true
    }
    return this
  }

  order(): this {
    return this
  }

  limit(value: number): this {
    this.maximum = value
    return this
  }

  range(from: number, to: number): this {
    this.rangeBounds = [from, to]
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
      let rows = this.database.editions.filter((edition) =>
        [...this.filters].every(([field, value]) =>
          Array.isArray(value)
            ? value.includes(edition[field as keyof typeof edition])
            : edition[field as keyof typeof edition] === value
        ) &&
        [...this.lowerBounds].every(([field, value]) =>
          String(edition[field as keyof typeof edition] ?? '') >= String(value)
        ) &&
        [...this.upperBounds].every(([field, value]) =>
          String(edition[field as keyof typeof edition] ?? '') < String(value)
        ) &&
        (!this.excludeLegacy || edition.status_confidence !== 'legacy_unknown')
      )
      const count = rows.length
      if (this.rangeBounds) rows = rows.slice(this.rangeBounds[0], this.rangeBounds[1] + 1)
      else if (this.maximum !== null) rows = rows.slice(0, this.maximum)
      return { data: rows, error: null, count: this.wantsCount ? count : undefined }
    }
    if (this.table === 'distributors') {
      return { data: this.database.distributors, error: null }
    }
    if (this.table === 'prints') {
      return { data: this.database.prints, error: null }
    }
    if (this.table === 'activity_log') {
      return { data: this.database.activities, error: null }
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

  prints = [{
    id: 5,
    name: 'Bembridge',
    short_name: 'Bemb',
    total_editions: 350,
    is_active: true,
    is_favorite: true,
  }]

  activities = [{
    id: 20,
    action: 'move',
    entity_type: 'edition',
    entity_id: 10,
    entity_name: 'Bembridge 12',
    field_name: 'distributor_id',
    old_value: 'Direct',
    new_value: 'Kendalls',
    description: 'Moved to Kendalls',
    related_entity_id: 2,
    related_entity_name: 'Kendalls',
    user_email: 'sue@example.com',
    created_at: '2026-08-30T10:00:00.000Z',
    source: 'assistant',
    proposal_id: '40000000-0000-4000-8000-000000000001',
  }]

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

test('loads a minimal live reference of active artworks and locations', async () => {
  const database = new FakeDatabase()
  database.prints.push({
    id: 6,
    name: 'Inactive artwork',
    short_name: 'Inactive',
    total_editions: 10,
    is_active: false,
    is_favorite: false,
  })
  database.distributors.push({
    id: 4,
    name: 'Closed gallery',
    commission_percentage: 30,
    is_active: false,
    is_favorite: false,
  })

  const reference = await getAssistantCatalogueReference(database.client())

  assert.ok(Number.isFinite(Date.parse(reference.loaded_at)))
  assert.deepEqual(reference.artworks, [{ id: 5, name: 'Bembridge', short_name: 'Bemb' }])
  assert.deepEqual(reference.locations, [
    { id: 1, name: 'Direct', commission_percentage: 0 },
    { id: 2, name: 'Kendalls', commission_percentage: 40 },
    { id: 3, name: 'Unknown', commission_percentage: null },
  ])
})

test('read tools return canonical app paths for resolved inventory and history', async () => {
  const database = new FakeDatabase()
  const client = database.client()

  const artworks = await findArtworks(client, 'Bemb')
  const locations = await findDistributors(client, 'Kendalls')
  const entries = await resolveInventoryEntries(client, [{
    artwork_query: 'Bemb',
    edition_number: 12,
  }])
  const history = await getRecentActivity(client, {})

  assert.equal(artworks.matches[0]?.app_path, '/artworks/5')
  assert.equal(locations.matches[0]?.app_path, '/galleries/2')
  assert.equal(entries.entries[0]?.artwork?.app_path, '/artworks/5')
  assert.equal(entries.entries[0]?.editions[0]?.app_path, '/editions/10')
  assert.equal(entries.entries[0]?.editions[0]?.location_app_path, '/galleries/1')
  assert.equal(history.history_app_path, '/changelog')
  assert.equal(history.activities[0]?.edition_app_path, '/editions/10')
})

test('queries sales by business date and gallery with deterministic totals and groups', async () => {
  const database = new FakeDatabase()
  const seaview = {
    id: 4,
    name: 'Seaview Gallery',
    commission_percentage: 40,
    is_active: true,
    is_favorite: true,
  }
  const priory = {
    id: 6,
    name: 'Priory',
    short_name: 'PRIOR',
    total_editions: 200,
    is_active: true,
    is_favorite: false,
  }
  const quayRocks = {
    id: 7,
    name: 'Quay Rocks Landscape',
    short_name: 'QRL',
    total_editions: 100,
    is_active: true,
    is_favorite: false,
  }
  database.distributors.push(seaview)
  database.prints.push(priory, quayRocks)
  const sale = (
    id: number,
    artwork: typeof priory,
    dateSold: string,
    price: number,
    overrides: Record<string, unknown> = {}
  ) => database.edition({
    id,
    print_id: artwork.id,
    distributor_id: seaview.id,
    edition_number: id,
    edition_display_name: `${artwork.name} ${id}`,
    is_printed: true,
    is_sold: true,
    retail_price: price,
    date_sold: dateSold,
    commission_percentage: 40,
    prints: artwork,
    distributors: seaview,
    ...overrides,
  })
  database.editions = [
    sale(21, quayRocks, '2026-07-11', 235, { is_settled: true }),
    sale(22, priory, '2026-07-13', 170),
    sale(23, quayRocks, '2026-07-25', 235),
    sale(24, priory, '2026-07-30', 170, { is_settled: true }),
    sale(25, priory, '2026-08-01', 170),
    sale(26, priory, '2026-07-20', 170, {
      distributor_id: 2,
      distributors: database.distributors[1],
    }),
    sale(27, priory, '2026-07-21', 170, { status_confidence: 'legacy_unknown' }),
  ]

  const result = await querySales(database.client(), {
    distributor_ids: [4],
    sold_from: '2026-07-01',
    sold_before: '2026-08-01',
    group_by: ['artwork'],
    include_editions: true,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.complete, true)
  assert.equal(result.matched_sale_count, 4)
  assert.deepEqual(result.totals, {
    sale_count: 4,
    priced_sale_count: 4,
    gross_value: 810,
    average_price: 202.5,
    commission_value: 324,
    net_value: 486,
    settled_sale_count: 2,
    unsettled_sale_count: 2,
    missing_price_count: 0,
    missing_commission_count: 0,
  })
  assert.deepEqual(
    result.groups.map((group) => ({
      artwork: (group.dimensions.artwork as { name: string }).name,
      count: group.totals.sale_count,
      gross: group.totals.gross_value,
    })),
    [
      { artwork: 'Quay Rocks Landscape', count: 2, gross: 470 },
      { artwork: 'Priory', count: 2, gross: 340 },
    ]
  )
  assert.equal(result.editions.length, 4)
  assert.equal(result.editions[0].date_sold, '2026-07-30')
  assert.equal(result.editions[0].edition_app_path, '/editions/24')
  assert.equal(result.sales_app_path, '/sales')
  assert.equal(result.editions_truncated, false)

  const crossBreakdown = await querySales(database.client(), {
    sold_from: '2026-07-01',
    sold_before: '2026-08-01',
    group_by: ['gallery', 'artwork'],
    include_editions: false,
  })
  assert.equal(crossBreakdown.ok, true)
  if (!crossBreakdown.ok) return
  assert.deepEqual(
    crossBreakdown.groups.map((group) => ({
      gallery: (group.dimensions.gallery as { name: string }).name,
      artwork: (group.dimensions.artwork as { name: string }).name,
      gross: group.totals.gross_value,
    })),
    [
      { gallery: 'Seaview Gallery', artwork: 'Quay Rocks Landscape', gross: 470 },
      { gallery: 'Seaview Gallery', artwork: 'Priory', gross: 340 },
      { gallery: 'Kendalls', artwork: 'Priory', gross: 170 },
    ]
  )
  assert.deepEqual(crossBreakdown.editions, [])
})

test('rejects an invalid or reversed sales date range', async () => {
  const database = new FakeDatabase()
  const invalid = await querySales(database.client(), { sold_from: '31 July 2026' })
  const reversed = await querySales(database.client(), {
    sold_from: '2026-08-01',
    sold_before: '2026-07-01',
  })

  assert.equal(invalid.ok, false)
  assert.match(invalid.error ?? '', /valid YYYY-MM-DD/)
  assert.equal(reversed.ok, false)
  assert.match(reversed.error ?? '', /must be after/)
})

test('paginates sales so totals are independent of the edition detail limit', async () => {
  const database = new FakeDatabase()
  database.editions = Array.from({ length: 1_005 }, (_, index) => database.edition({
    id: index + 1,
    is_printed: true,
    is_sold: true,
    retail_price: 100,
    date_sold: '2026-07-15',
    commission_percentage: 40,
  }))

  const result = await querySales(database.client(), {
    sold_from: '2026-07-01',
    sold_before: '2026-08-01',
    include_editions: true,
    limit: 2,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.complete, true)
  assert.equal(result.matched_sale_count, 1_005)
  assert.equal(result.totals.sale_count, 1_005)
  assert.equal(result.totals.gross_value, 100_500)
  assert.equal(result.editions.length, 2)
  assert.equal(result.editions_truncated, true)
})

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
