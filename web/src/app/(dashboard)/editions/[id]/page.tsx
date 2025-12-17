import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { EditionDetail } from './edition-detail'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EditionPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: edition, error } = await supabase
    .from('editions')
    .select(`
      *,
      prints(id, name, total_editions),
      distributors(id, name, commission_percentage)
    `)
    .eq('id', parseInt(id))
    .single()

  if (error || !edition) {
    notFound()
  }

  // Fetch all distributors for the location dropdown
  const { data: distributors } = await supabase
    .from('distributors')
    .select('id, name, commission_percentage')
    .order('name')

  return (
    <div className="space-y-6">
      <EditionDetail edition={edition} distributors={distributors || []} />
    </div>
  )
}
