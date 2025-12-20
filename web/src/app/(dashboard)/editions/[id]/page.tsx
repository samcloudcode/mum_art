'use client'

import { use } from 'react'
import { useInventory } from '@/lib/hooks/use-inventory'
import { EditionDetail } from './edition-detail'

type PageProps = {
  params: Promise<{ id: string }>
}

export default function EditionPage({ params }: PageProps) {
  const { id } = use(params)
  const { allEditions, distributors, isReady, update, isSaving } = useInventory()

  if (!isReady) {
    return null // InventoryProvider handles loading state
  }

  const edition = allEditions.find(e => e.id === parseInt(id))

  if (!edition) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Edition Not Found</h1>
        <p className="text-gray-600 mt-2">The edition you&apos;re looking for doesn&apos;t exist.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <EditionDetail
        edition={edition}
        distributors={distributors.map(d => ({
          id: d.id,
          name: d.name,
          commission_percentage: d.commission_percentage,
        }))}
        onUpdate={update}
        isSaving={isSaving}
      />
    </div>
  )
}
