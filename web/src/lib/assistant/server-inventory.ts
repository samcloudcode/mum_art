import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AssistantProposal,
  InventoryAction,
  ProposalEditionPreview,
  ProposalFieldChange,
  ProposalPreview,
} from './types'

const MAX_TOOL_RESULTS = 100
const MAX_PROPOSAL_EDITIONS = 100

type ArtworkLookup = {
  id: number
  name: string
  short_name: string | null
  total_editions: number | null
  is_active: boolean | null
  is_favorite: boolean | null
}

type DistributorLookup = {
  id: number
  name: string
  commission_percentage: number | null
  is_active: boolean | null
  is_favorite: boolean | null
}

type EditionRecord = {
  id: number
  print_id: number
  distributor_id: number | null
  edition_number: number | null
  edition_type: string | null
  edition_display_name: string
  is_printed: boolean | null
  is_sold: boolean | null
  is_stock_checked: boolean | null
  date_in_gallery: string | null
  size: string | null
  frame_type: string | null
  status_confidence: string | null
  is_active: boolean | null
  updated_at: string | null
  prints: ArtworkLookup | ArtworkLookup[] | null
  distributors: DistributorLookup | DistributorLookup[] | null
}

type InventoryEntry = {
  artwork_query: string
  edition_number: number
  edition_type?: 'numbered' | 'ap'
}

type AllowedPatch = {
  is_printed?: boolean
  distributor_id?: number
  date_in_gallery?: string | null
  is_stock_checked?: boolean
}

type CompiledChange = {
  edition_id: number
  expected_updated_at: string
  patch: AllowedPatch
  action: 'update' | 'move'
  description: string
}

type WorkingEdition = {
  row: EditionRecord
  patch: AllowedPatch
  intents: Set<InventoryAction['type']>
  destinations: Set<number>
  confirmationLocations: Set<number>
  missingFromLocations: Set<number>
}

type ProposalRow = {
  id: string
  status: AssistantProposal['status']
  preview: ProposalPreview
  expires_at: string
  applied_at: string | null
  result: Record<string, unknown> | null
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function normalized(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0]
    previous[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j]
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      diagonal = above
    }
  }
  return previous[b.length]
}

function matchScore(query: string, ...candidates: Array<string | null>): number {
  const q = normalized(query)
  if (!q) return 0

  let best = 0
  for (const candidate of candidates) {
    if (!candidate) continue
    const value = normalized(candidate)
    if (value === q) best = Math.max(best, 100)
    else if (value.startsWith(q) || q.startsWith(value)) best = Math.max(best, 85)
    else if (value.includes(q) || q.includes(value)) best = Math.max(best, 70)
    else {
      const distance = editDistance(q, value)
      const similarity = 1 - distance / Math.max(q.length, value.length, 1)
      if (similarity >= 0.72) best = Math.max(best, Math.round(similarity * 70))
    }
  }
  return best
}

async function loadArtworks(supabase: SupabaseClient): Promise<ArtworkLookup[]> {
  const { data, error } = await supabase
    .from('prints')
    .select('id,name,short_name,total_editions,is_active,is_favorite')
    .order('name')

  if (error) throw new Error('Could not search the artwork catalogue')
  return (data ?? []) as unknown as ArtworkLookup[]
}

async function loadDistributors(supabase: SupabaseClient): Promise<DistributorLookup[]> {
  const { data, error } = await supabase
    .from('distributors')
    .select('id,name,commission_percentage,is_active,is_favorite')
    .order('name')

  if (error) throw new Error('Could not search inventory locations')
  return (data ?? []) as unknown as DistributorLookup[]
}

function publicEdition(edition: EditionRecord) {
  const artwork = one(edition.prints)
  const distributor = one(edition.distributors)
  return {
    id: edition.id,
    artwork_id: edition.print_id,
    artwork_name: artwork?.name ?? 'Unknown artwork',
    artwork_short_name: artwork?.short_name ?? null,
    edition_number: edition.edition_number,
    edition_type: edition.edition_type ?? 'numbered',
    edition_name: edition.edition_display_name,
    location_id: edition.distributor_id,
    location_name: distributor?.name ?? null,
    is_printed: Boolean(edition.is_printed),
    is_sold: Boolean(edition.is_sold),
    is_stock_checked: Boolean(edition.is_stock_checked),
    date_in_gallery: edition.date_in_gallery,
    size: edition.size,
    frame_type: edition.frame_type,
    status_confidence: edition.status_confidence,
  }
}

const EDITION_SELECT = `
  id,print_id,distributor_id,edition_number,edition_type,edition_display_name,
  is_printed,is_sold,is_stock_checked,date_in_gallery,size,frame_type,
  status_confidence,is_active,updated_at,
  prints(id,name,short_name,total_editions,is_active,is_favorite),
  distributors(id,name,commission_percentage,is_active,is_favorite)
`

export async function findArtworks(
  supabase: SupabaseClient,
  query: string,
  limit = 10
) {
  const artworks = await loadArtworks(supabase)
  const matches = artworks
    .filter((artwork) => artwork.is_active !== false)
    .map((artwork) => ({ artwork, score: matchScore(query, artwork.name, artwork.short_name) }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(Boolean(b.artwork.is_favorite)) - Number(Boolean(a.artwork.is_favorite)) ||
        a.artwork.name.localeCompare(b.artwork.name)
    )
    .slice(0, Math.min(Math.max(limit, 1), 20))

  return {
    query,
    matches: matches.map(({ artwork, score }) => ({
      id: artwork.id,
      name: artwork.name,
      short_name: artwork.short_name,
      total_numbered_editions: artwork.total_editions,
      match_score: score,
    })),
  }
}

export async function findDistributors(
  supabase: SupabaseClient,
  query: string,
  limit = 10
) {
  const distributors = await loadDistributors(supabase)
  const matches = distributors
    .filter((distributor) => distributor.is_active !== false)
    .map((distributor) => ({ distributor, score: matchScore(query, distributor.name) }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(Boolean(b.distributor.is_favorite)) - Number(Boolean(a.distributor.is_favorite)) ||
        a.distributor.name.localeCompare(b.distributor.name)
    )
    .slice(0, Math.min(Math.max(limit, 1), 20))

  return {
    query,
    matches: matches.map(({ distributor, score }) => ({
      id: distributor.id,
      name: distributor.name,
      commission_percentage: distributor.commission_percentage,
      match_score: score,
    })),
  }
}

export async function findEditions(
  supabase: SupabaseClient,
  filters: {
    print_id?: number
    distributor_id?: number
    edition_numbers?: number[]
    edition_type?: 'numbered' | 'ap'
    is_printed?: boolean
    is_sold?: boolean
    include_legacy?: boolean
    limit?: number
  }
) {
  if (!filters.print_id && !filters.distributor_id) {
    return {
      error: 'Choose an artwork or location before searching editions',
      matches: [],
    }
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), MAX_TOOL_RESULTS)
  let query = supabase.from('editions').select(EDITION_SELECT).order('id').limit(limit + 1)

  if (filters.print_id) query = query.eq('print_id', filters.print_id)
  if (filters.distributor_id) query = query.eq('distributor_id', filters.distributor_id)
  if (filters.edition_numbers?.length) {
    query = query.in('edition_number', [...new Set(filters.edition_numbers)].slice(0, 100))
  }
  if (filters.edition_type) query = query.eq('edition_type', filters.edition_type)
  if (filters.is_printed !== undefined) query = query.eq('is_printed', filters.is_printed)
  if (filters.is_sold !== undefined) query = query.eq('is_sold', filters.is_sold)
  if (!filters.include_legacy) {
    query = query.or('status_confidence.neq.legacy_unknown,status_confidence.is.null')
  }

  const { data, error } = await query
  if (error) throw new Error('Could not search editions')
  const rows = (data ?? []) as unknown as EditionRecord[]

  return {
    matches: rows.slice(0, limit).map(publicEdition),
    truncated: rows.length > limit,
  }
}

export async function getGalleryStock(
  supabase: SupabaseClient,
  distributorId: number,
  printId?: number,
  limit = MAX_TOOL_RESULTS
) {
  return findEditions(supabase, {
    distributor_id: distributorId,
    print_id: printId,
    is_printed: true,
    is_sold: false,
    limit,
  })
}

export async function resolveInventoryEntries(
  supabase: SupabaseClient,
  entries: InventoryEntry[]
) {
  const requested = entries.slice(0, 50)
  const artworks = (await loadArtworks(supabase)).filter((artwork) => artwork.is_active !== false)
  const resolutions = requested.map((entry, index) => {
    const candidates = artworks
      .map((artwork) => ({ artwork, score: matchScore(entry.artwork_query, artwork.name, artwork.short_name) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.artwork.name.localeCompare(b.artwork.name))
      .slice(0, 4)
    const first = candidates[0]
    const second = candidates[1]
    const unambiguous = Boolean(
      first &&
      first.score >= 70 &&
      (!second || first.score - second.score >= 15 || (first.score === 100 && second.score < 100))
    )
    return { index, entry, candidates, resolvedArtwork: unambiguous ? first.artwork : null }
  })

  const printIds = [...new Set(resolutions.flatMap((item) => item.resolvedArtwork?.id ?? []))]
  const editionNumbers = [...new Set(requested.map((entry) => entry.edition_number))]
  let editions: EditionRecord[] = []

  if (printIds.length > 0 && editionNumbers.length > 0) {
    const { data, error } = await supabase
      .from('editions')
      .select(EDITION_SELECT)
      .in('print_id', printIds)
      .in('edition_number', editionNumbers)
      .order('id')
      .limit(3_000)
    if (error) throw new Error('Could not resolve the inventory entries')
    editions = (data ?? []) as unknown as EditionRecord[]
  }

  return {
    entries: resolutions.map(({ index, entry, candidates, resolvedArtwork }) => {
      if (!resolvedArtwork) {
        return {
          index,
          input: entry,
          status: candidates.length === 0 ? 'artwork_not_found' : 'artwork_ambiguous',
          artwork_candidates: candidates.map(({ artwork, score }) => ({
            id: artwork.id,
            name: artwork.name,
            short_name: artwork.short_name,
            match_score: score,
          })),
          editions: [],
        }
      }

      const matches = editions.filter(
        (edition) =>
          edition.print_id === resolvedArtwork.id &&
          edition.edition_number === entry.edition_number &&
          (!entry.edition_type || (edition.edition_type ?? 'numbered') === entry.edition_type)
      )
      return {
        index,
        input: entry,
        status: matches.length === 1 ? 'matched' : matches.length === 0 ? 'edition_not_found' : 'edition_ambiguous',
        artwork: { id: resolvedArtwork.id, name: resolvedArtwork.name },
        editions: matches.map(publicEdition),
      }
    }),
  }
}

export async function getRecentActivity(
  supabase: SupabaseClient,
  filters: {
    edition_id?: number
    distributor_id?: number
    action?: string
    since?: string
    limit?: number
  }
) {
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 50)
  let distributor: DistributorLookup | null = null
  if (filters.distributor_id) {
    const distributors = await loadDistributors(supabase)
    distributor = distributors.find((item) => item.id === filters.distributor_id) ?? null
    if (!distributor) return { error: 'Location not found', activities: [] }
  }

  let query = supabase
    .from('activity_log')
    .select(
      'id,action,entity_type,entity_id,entity_name,field_name,old_value,new_value,description,related_entity_id,related_entity_name,user_email,created_at,source,proposal_id'
    )
    .order('created_at', { ascending: false })
    .limit(distributor ? 200 : limit)

  if (filters.edition_id) {
    query = query.eq('entity_type', 'edition').eq('entity_id', filters.edition_id)
  }
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.since) query = query.gte('created_at', filters.since)

  const { data, error } = await query
  if (error) throw new Error('Could not read inventory history')

  type ActivityRow = {
    id: number
    action: string
    entity_type: string
    entity_id: number | null
    entity_name: string | null
    field_name: string | null
    old_value: string | null
    new_value: string | null
    description: string | null
    related_entity_id: number | null
    related_entity_name: string | null
    user_email: string | null
    created_at: string
    source: string | null
    proposal_id: string | null
  }

  const rows = ((data ?? []) as unknown as ActivityRow[])
    .filter(
      (activity) =>
        !distributor ||
        activity.related_entity_id === distributor.id ||
        activity.related_entity_name === distributor.name ||
        activity.old_value === distributor.name ||
        activity.new_value === distributor.name
    )
    .slice(0, limit)

  return {
    activities: rows.map((activity) => ({
      id: activity.id,
      when: activity.created_at,
      action: activity.action,
      edition_id: activity.entity_type === 'edition' ? activity.entity_id : null,
      edition_name: activity.entity_name,
      field: activity.field_name,
      before: activity.old_value,
      after: activity.new_value,
      description: activity.description,
      changed_by: activity.user_email?.split('@')[0] ?? null,
      source: activity.source ?? 'app',
      proposal_id: activity.proposal_id,
    })),
  }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function labelValue(field: keyof AllowedPatch, value: unknown, distributors: Map<number, DistributorLookup>): string {
  if (field === 'is_printed') return value ? 'Printed' : 'Not printed'
  if (field === 'is_stock_checked') return value ? 'Confirmed here' : 'Not confirmed here'
  if (field === 'distributor_id') {
    return typeof value === 'number'
      ? distributors.get(value)?.name ?? `Location ${value}`
      : 'No recorded location'
  }
  return typeof value === 'string' ? value : 'Not set'
}

function actionDescription(working: WorkingEdition, distributors: Map<number, DistributorLookup>): {
  action: 'update' | 'move'
  description: string
} {
  const destination = working.patch.distributor_id
    ? distributors.get(working.patch.distributor_id)?.name
    : null

  if (working.intents.has('report_stock_missing')) {
    const sourceId = [...working.missingFromLocations][0]
    return {
      action: 'move',
      description: `Reported missing from ${distributors.get(sourceId)?.name ?? 'its recorded location'}; moved to Unknown`,
    }
  }
  if (working.intents.has('receive_stock_at_gallery')) {
    return { action: 'move', description: `Received into ${destination ?? 'the location'} and confirmed present` }
  }
  if (working.intents.has('move_stock')) {
    const alsoPrinted = working.intents.has('mark_printed') ? ' and marked as printed' : ''
    return { action: 'move', description: `Moved to ${destination ?? 'the location'}${alsoPrinted}` }
  }
  if (working.intents.has('confirm_stock_present')) {
    return { action: 'update', description: 'Confirmed present at the recorded location' }
  }
  return { action: 'update', description: 'Marked as printed' }
}

export function toAssistantProposal(row: ProposalRow): AssistantProposal {
  return {
    id: row.id,
    status: row.status,
    preview: row.preview,
    expiresAt: row.expires_at,
    appliedAt: row.applied_at,
    result: row.result,
  }
}

export async function draftInventoryProposal(
  supabase: SupabaseClient,
  params: {
    conversationId: string
    userId: string
    requestText: string
    actions: InventoryAction[]
    model: string
    canWrite: boolean
  }
): Promise<{ ok: boolean; proposal?: AssistantProposal; error?: string; noChanges?: boolean }> {
  if (!params.canWrite) return { ok: false, error: 'This account has read-only access' }
  if (params.actions.length === 0) return { ok: false, error: 'At least one action is required' }

  const editionIds = [
    ...new Set(
      params.actions.flatMap((action) => action.edition_ids).filter(Number.isSafeInteger)
    ),
  ].sort((a, b) => a - b)

  if (editionIds.length === 0 || editionIds.length > MAX_PROPOSAL_EDITIONS) {
    return { ok: false, error: `A proposal must affect between 1 and ${MAX_PROPOSAL_EDITIONS} editions` }
  }
  if (params.actions.some((action) => action.edition_ids.some((id) => !editionIds.includes(id)))) {
    return { ok: false, error: 'Every edition ID must be a valid integer' }
  }

  const [{ data, error }, distributors] = await Promise.all([
    supabase.from('editions').select(EDITION_SELECT).in('id', editionIds).order('id'),
    loadDistributors(supabase),
  ])
  if (error) return { ok: false, error: 'The target editions could not be loaded' }

  const editions = (data ?? []) as unknown as EditionRecord[]
  if (editions.length !== editionIds.length) {
    return { ok: false, error: 'One or more target editions no longer exist' }
  }

  const distributorMap = new Map(distributors.map((distributor) => [distributor.id, distributor]))
  const unknownDistributor = distributors.find((distributor) => normalized(distributor.name) === 'unknown')
  const working = new Map<number, WorkingEdition>(
    editions.map((row) => [
      row.id,
      {
        row,
        patch: {},
        intents: new Set(),
        destinations: new Set(),
        confirmationLocations: new Set(),
        missingFromLocations: new Set(),
      },
    ])
  )

  const getTargets = (action: InventoryAction): WorkingEdition[] =>
    action.edition_ids.map((id) => working.get(id)).filter((item): item is WorkingEdition => Boolean(item))

  for (const action of params.actions) {
    const targets = getTargets(action)
    if (targets.length !== new Set(action.edition_ids).size) {
      return { ok: false, error: `Action ${action.type} contains a missing or duplicate edition` }
    }

    if ('distributor_id' in action) {
      const distributor = distributorMap.get(action.distributor_id)
      if (!distributor || distributor.is_active === false) {
        return { ok: false, error: `Location ${action.distributor_id} does not exist or is inactive` }
      }
    }
    if ('date_in_gallery' in action && !validDate(action.date_in_gallery)) {
      return { ok: false, error: `${action.date_in_gallery} is not a valid calendar date` }
    }

    for (const target of targets) {
      target.intents.add(action.type)
      if (action.type === 'mark_printed') {
        target.patch.is_printed = true
      } else if (action.type === 'move_stock') {
        target.destinations.add(action.distributor_id)
        target.patch.distributor_id = action.distributor_id
        target.patch.date_in_gallery = action.date_in_gallery
        if (target.row.distributor_id !== action.distributor_id) {
          target.patch.is_stock_checked = false
        }
      } else if (action.type === 'confirm_stock_present') {
        target.confirmationLocations.add(action.distributor_id)
        target.patch.is_stock_checked = true
      } else if (action.type === 'report_stock_missing') {
        if (!unknownDistributor) {
          return { ok: false, error: 'No active location named Unknown exists' }
        }
        target.missingFromLocations.add(action.distributor_id)
        target.destinations.add(unknownDistributor.id)
        target.patch.distributor_id = unknownDistributor.id
        target.patch.date_in_gallery = null
        target.patch.is_stock_checked = false
      } else if (action.type === 'receive_stock_at_gallery') {
        target.destinations.add(action.distributor_id)
        target.confirmationLocations.add(action.distributor_id)
        target.patch.is_printed = true
        target.patch.distributor_id = action.distributor_id
        target.patch.date_in_gallery = action.date_in_gallery
        target.patch.is_stock_checked = true
      }
    }
  }

  const compiled: CompiledChange[] = []
  const previews: ProposalEditionPreview[] = []
  let omittedNoOps = 0

  for (const target of [...working.values()].sort((a, b) => a.row.id - b.row.id)) {
    const { row, patch, intents } = target
    if (row.is_active === false) return { ok: false, error: `${row.edition_display_name} is inactive` }
    if (row.status_confidence === 'legacy_unknown') {
      return { ok: false, error: `${row.edition_display_name} has legacy-unknown status and needs explicit manual review` }
    }
    if (row.is_sold) return { ok: false, error: `${row.edition_display_name} is recorded as sold` }
    if (!row.updated_at) return { ok: false, error: `${row.edition_display_name} has no update version and cannot be safely proposed` }
    if (target.destinations.size > 1) {
      return { ok: false, error: `${row.edition_display_name} has conflicting destination instructions` }
    }
    if (intents.has('report_stock_missing') && (intents.has('confirm_stock_present') || intents.has('receive_stock_at_gallery'))) {
      return { ok: false, error: `${row.edition_display_name} cannot be both present and missing` }
    }
    for (const sourceId of target.missingFromLocations) {
      if (row.distributor_id !== sourceId) {
        return {
          ok: false,
          error: `${row.edition_display_name} is not currently recorded at ${distributorMap.get(sourceId)?.name ?? `location ${sourceId}`}`,
        }
      }
    }

    const finalDistributor = patch.distributor_id ?? row.distributor_id
    const finalPrinted = patch.is_printed ?? Boolean(row.is_printed)
    const finalChecked = patch.is_stock_checked ?? Boolean(row.is_stock_checked)
    for (const expectedId of target.confirmationLocations) {
      if (finalDistributor !== expectedId) {
        return {
          ok: false,
          error: `${row.edition_display_name} is not being placed at ${distributorMap.get(expectedId)?.name ?? `location ${expectedId}`}`,
        }
      }
    }
    if (finalDistributor !== null && !finalPrinted) {
      return { ok: false, error: `${row.edition_display_name} must be marked printed before it can be moved` }
    }
    if (finalChecked && (!finalPrinted || finalDistributor === null)) {
      return { ok: false, error: `${row.edition_display_name} cannot be confirmed without printed stock at a location` }
    }

    const actualPatch: AllowedPatch = {}
    if (patch.is_printed !== undefined && patch.is_printed !== Boolean(row.is_printed)) actualPatch.is_printed = patch.is_printed
    if (patch.distributor_id !== undefined && patch.distributor_id !== row.distributor_id) actualPatch.distributor_id = patch.distributor_id
    if (patch.date_in_gallery !== undefined && patch.date_in_gallery !== row.date_in_gallery) actualPatch.date_in_gallery = patch.date_in_gallery
    if (patch.is_stock_checked !== undefined && patch.is_stock_checked !== Boolean(row.is_stock_checked)) {
      actualPatch.is_stock_checked = patch.is_stock_checked
    }

    const fields = Object.keys(actualPatch) as Array<keyof AllowedPatch>
    if (fields.length === 0) {
      omittedNoOps += 1
      continue
    }

    const changes: ProposalFieldChange[] = fields.map((field) => {
      const previewField = field === 'distributor_id' ? 'location' : field
      const labels = {
        is_printed: 'Printed',
        distributor_id: 'Location',
        date_in_gallery: 'In gallery from',
        is_stock_checked: 'Stock confirmation',
      } as const
      return {
        field: previewField,
        label: labels[field],
        before: labelValue(field, row[field], distributorMap),
        after: labelValue(field, actualPatch[field], distributorMap),
      }
    })
    const description = actionDescription(target, distributorMap)
    compiled.push({
      edition_id: row.id,
      expected_updated_at: row.updated_at,
      patch: actualPatch,
      action: description.action,
      description: description.description,
    })

    const artwork = one(row.prints)
    const editionType = row.edition_type ?? 'numbered'
    previews.push({
      editionId: row.id,
      editionName: row.edition_display_name,
      artworkName: artwork?.name ?? 'Unknown artwork',
      editionLabel: editionType === 'ap' ? `AP ${row.edition_number ?? '?'}` : `Edition ${row.edition_number ?? '?'}`,
      changes,
    })
  }

  if (compiled.length === 0) return { ok: true, noChanges: true }

  const actionLabels = new Set(
    params.actions.map((action) => {
      if (action.type === 'mark_printed') return 'mark as printed'
      if (action.type === 'move_stock') return 'move stock'
      if (action.type === 'confirm_stock_present') return 'confirm stock present'
      if (action.type === 'report_stock_missing') return 'report missing stock'
      return 'receive stock at a gallery'
    })
  )
  const warnings = omittedNoOps > 0 ? [`${omittedNoOps} already-correct edition${omittedNoOps === 1 ? ' was' : 's were'} omitted.`] : []
  const preview: ProposalPreview = {
    summary: `${compiled.length} edition${compiled.length === 1 ? '' : 's'}: ${[...actionLabels].join(', ')}`,
    editions: previews,
    warnings,
  }
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  const { error: supersedeError } = await supabase
    .from('assistant_proposals')
    .update({ status: 'superseded', updated_at: new Date().toISOString() })
    .eq('conversation_id', params.conversationId)
    .eq('user_id', params.userId)
    .eq('status', 'pending')
  if (supersedeError) return { ok: false, error: 'The previous proposal could not be superseded' }

  const { data: inserted, error: insertError } = await supabase
    .from('assistant_proposals')
    .insert({
      conversation_id: params.conversationId,
      user_id: params.userId,
      status: 'pending',
      request_text: params.requestText,
      requested_actions: params.actions,
      compiled_changes: compiled,
      preview,
      model: params.model,
      expires_at: expiresAt,
    })
    .select('id,status,preview,expires_at,applied_at,result')
    .single()

  if (insertError || !inserted) return { ok: false, error: 'The proposal could not be saved' }
  return { ok: true, proposal: toAssistantProposal(inserted as unknown as ProposalRow) }
}
