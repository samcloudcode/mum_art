import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch some stats to verify RLS is working
  const { count: editionsCount } = await supabase
    .from('editions')
    .select('*', { count: 'exact', head: true })

  const { count: printsCount } = await supabase
    .from('prints')
    .select('*', { count: 'exact', head: true })

  const { count: distributorsCount } = await supabase
    .from('distributors')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600">Welcome to your art print inventory</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Editions</CardDescription>
            <CardTitle className="text-3xl">{editionsCount?.toLocaleString() ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">Individual prints in inventory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Print Designs</CardDescription>
            <CardTitle className="text-3xl">{printsCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">Unique artwork designs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Distributors</CardDescription>
            <CardTitle className="text-3xl">{distributorsCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">Galleries and locations</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authentication Working!</CardTitle>
          <CardDescription>
            You are successfully logged in and can query the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            This page is protected - only authenticated users can see it.
            The stats above are fetched from Supabase with RLS policies in effect.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
