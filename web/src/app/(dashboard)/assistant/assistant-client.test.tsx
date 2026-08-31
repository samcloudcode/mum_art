import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  assistantSpeechPhrases,
  AssistantMessageContent,
  ConversationHistory,
  ProposalCard,
} from './assistant-client'
import type { AssistantProposal } from '@/lib/assistant/types'

test('proposal card renders exact before and after values with an explicit confirmation', () => {
  const proposal: AssistantProposal = {
    id: '10000000-0000-4000-8000-000000000001',
    status: 'pending',
    expiresAt: '2026-08-30T12:00:00.000Z',
    appliedAt: null,
    preview: {
      summary: '1 edition: move stock',
      warnings: [],
      editions: [
        {
          editionId: 10,
          editionName: 'Bembridge 12',
          artworkName: 'Bembridge',
          editionLabel: 'Edition 12',
          changes: [
            {
              field: 'location',
              label: 'Location',
              before: 'Direct',
              after: 'Kendalls',
            },
          ],
        },
      ],
    },
  }

  const html = renderToStaticMarkup(
    <ProposalCard
      proposal={proposal}
      isApplying={false}
      onConfirm={() => undefined}
      onDismiss={() => undefined}
    />
  )

  assert.match(html, /Awaiting confirmation/)
  assert.match(html, /Bembridge/)
  assert.match(html, /Direct/)
  assert.match(html, /Kendalls/)
  assert.match(html, /href="\/editions\/10"/)
  assert.match(html, /Nothing has changed yet/)
  assert.match(html, /Confirm 1 edition/)
  assert.match(html, /Dismiss/)
})

test('an applied reversible proposal offers to prepare an undo', () => {
  const proposal: AssistantProposal = {
    id: '10000000-0000-4000-8000-000000000002',
    status: 'applied',
    expiresAt: '2026-08-30T12:00:00.000Z',
    appliedAt: '2026-08-30T11:45:00.000Z',
    undoable: true,
    preview: {
      summary: '1 edition: mark as sold',
      warnings: [],
      editions: [
        {
          editionId: 10,
          editionName: 'Bembridge 12',
          artworkName: 'Bembridge',
          editionLabel: 'Edition 12',
          changes: [
            {
              field: 'is_sold',
              label: 'Sale status',
              before: 'Unsold',
              after: 'Sold',
            },
          ],
        },
      ],
    },
  }

  const html = renderToStaticMarkup(
    <ProposalCard
      proposal={proposal}
      isApplying={false}
      onConfirm={() => undefined}
      onDismiss={() => undefined}
      onUndo={() => undefined}
    />
  )

  assert.match(html, /Applied/)
  assert.match(html, /Undo this change/)
  assert.doesNotMatch(html, /Confirm 1 edition/)
})

test('assistant replies render GFM structure for readable mobile content', () => {
  const html = renderToStaticMarkup(
    <AssistantMessageContent
      content={`## Kendalls stock

- **Bembridge 12**
- Ducie 4

| Artwork | Edition |
| --- | --- |
| Bembridge | 12 |

~~Legacy note~~`}
    />
  )

  assert.match(html, /<h2/)
  assert.match(html, /<ul/)
  assert.match(html, /<strong/)
  assert.match(html, /overflow-x-auto/)
  assert.match(html, /<table/)
  assert.match(html, /<del>Legacy note<\/del>/)
})

test('assistant replies navigate app links in-app and reject other relative links', () => {
  const html = renderToStaticMarkup(
    <AssistantMessageContent
      content="Open [Bembridge 12](/editions/10), not [a database path](/rest/v1/editions), or [the external guide](https://example.com/guide)."
    />
  )

  assert.match(html, /href="\/editions\/10"/)
  assert.doesNotMatch(html, /href="\/editions\/10"[^>]*target=/)
  assert.doesNotMatch(html, /href="\/rest\/v1\/editions"/)
  assert.match(html, /href="https:\/\/example.com\/guide" target="_blank" rel="noreferrer"/)
})

test('conversation history shows prior threads and identifies the current one', () => {
  const html = renderToStaticMarkup(
    <ConversationHistory
      conversations={[
        {
          id: 'conversation-1',
          title: 'Move Bembridge 12',
          createdAt: '2026-08-30T09:00:00.000Z',
          updatedAt: '2026-08-30T10:00:00.000Z',
        },
      ]}
      currentId="conversation-1"
      isLoading={false}
      onSelect={() => undefined}
    />
  )

  assert.match(html, /Recent conversations/)
  assert.match(html, /Move Bembridge 12/)
  assert.match(html, /border-accent\/40/)
})

test('voice dictation hints include artwork names, abbreviations, and galleries', () => {
  const phrases = assistantSpeechPhrases(
    [{ name: 'Bembridge Harbour', short_name: 'Bemb' }],
    [{ name: 'Kendalls Fine Art' }]
  )

  assert.ok(phrases.includes('Bembridge Harbour'))
  assert.ok(phrases.includes('Bemb'))
  assert.ok(phrases.includes('Kendalls Fine Art'))
  assert.ok(phrases.includes('artist proof'))
})
