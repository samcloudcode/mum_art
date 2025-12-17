import { createClient } from '@/lib/supabase/server'
import { SalesByMonth } from './sales-by-month'

export default async function SalesPage() {
  const supabase = await createClient()

  // Fetch all sold editions with distributor info
  const { data: sales, error } = await supabase
    .from('editions')
    .select(`
      *,
      prints(id, name),
      distributors(id, name, commission_percentage)
    `)
    .eq('is_sold', true)
    .order('date_sold', { ascending: false })

  // Group by month
  type Sale = NonNullable<typeof sales>[number]
  const monthlyGroups = new Map<string, {
    month: string
    year: number
    sales: Sale[]
    totalRetail: number
    totalNet: number
    unsettledNet: number
    unsettledCount: number
  }>()

  sales?.forEach((sale) => {
    const date = sale.date_sold ? new Date(sale.date_sold) : new Date()
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthName = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    const current = monthlyGroups.get(monthKey) || {
      month: monthName,
      year: date.getFullYear(),
      sales: [],
      totalRetail: 0,
      totalNet: 0,
      unsettledNet: 0,
      unsettledCount: 0,
    }

    current.sales.push(sale)
    current.totalRetail += sale.retail_price || 0

    const commission = sale.commission_percentage || sale.distributors?.commission_percentage || 0
    const netAmount = (sale.retail_price || 0) * (1 - commission / 100)
    current.totalNet += netAmount

    if (!sale.is_settled) {
      current.unsettledNet += netAmount
      current.unsettledCount++
    }

    monthlyGroups.set(monthKey, current)
  })

  // Convert to sorted array (newest first)
  const monthlyData = Array.from(monthlyGroups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, data]) => ({
      key,
      ...data,
    }))

  // Calculate totals
  const totalStats = {
    totalSales: sales?.length || 0,
    totalRevenue: sales?.reduce((sum, s) => sum + (s.retail_price || 0), 0) || 0,
    totalUnsettled: monthlyData.reduce((sum, m) => sum + m.unsettledNet, 0),
    unsettledCount: monthlyData.reduce((sum, m) => sum + m.unsettledCount, 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-600">
            {totalStats.totalSales} sales totaling £{totalStats.totalRevenue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Sales</p>
          <p className="text-2xl font-bold">{totalStats.totalSales}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-2xl font-bold">£{totalStats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Unsettled</p>
          <p className="text-2xl font-bold text-amber-600">
            £{totalStats.totalUnsettled.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">{totalStats.unsettledCount} sales pending</p>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">Error loading sales: {error.message}</p>
        </div>
      ) : (
        <SalesByMonth monthlyData={monthlyData} />
      )}
    </div>
  )
}
