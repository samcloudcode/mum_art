import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AssistantMessageContent, ProposalCard } from './assistant-client'
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
  assert.match(html, /Nothing has changed yet/)
  assert.match(html, /Confirm 1 edition/)
  assert.match(html, /Dismiss/)
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
