import { StatCard, StatGrid } from '@/components/StatCard/StatCard'
import { formatCedis } from '@/lib/format'
import type { OrderSummary } from '@/lib/orders'

export function OrderSummaryTiles({ summary }: { summary: OrderSummary }) {
  return (
    <StatGrid label="Order totals">
      <StatCard label="Orders" value={summary.orders} note="Paid or cash on delivery" />
      <StatCard
        label="Open orders"
        value={summary.open}
        valueTone={summary.open > 0 ? 'warning' : undefined}
        note="New, confirmed or out for delivery"
      />
      <StatCard label="Delivered sales" value={formatCedis(summary.deliveredSales)} note="Including delivery fees" />
      <StatCard label="Buyers" value={summary.buyers} note="Unique phone numbers" />
    </StatGrid>
  )
}
