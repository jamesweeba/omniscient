import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/StatusBadge/StatusBadge'
import { formatCedis, formatTimeAgo } from '@/lib/format'
import { periodLinkParams } from '@/lib/orderDisplay'
import type { OrderShopRow, PeriodQuery } from '@/lib/orders'
import table from '@/styles/table.module.css'

const COLUMN_COUNT = 8

interface OrderVendorsTableProps {
  rows: OrderShopRow[]
  /** Carried to the shop's page, so it shows the same orders. */
  search: string
  period: PeriodQuery
  emptyMessage: ReactNode
}

export function OrderVendorsTable({ rows, search, period, emptyMessage }: OrderVendorsTableProps) {
  return (
    <div className={table.scroll}>
      <table className={table.table}>
        <thead>
          <tr>
            <th>Shop</th>
            <th>Market</th>
            <th>Status</th>
            <th>Orders</th>
            <th>Open</th>
            <th>Delivered sales</th>
            <th>Last order</th>
            <th>
              <span className={table.visuallyHidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={table.emptyCell} colSpan={COLUMN_COUNT}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => <ShopRow key={row.shop.id} row={row} search={search} period={period} />)
          )}
        </tbody>
      </table>
    </div>
  )
}

function ShopRow({ row, search, period }: { row: OrderShopRow; search: string; period: PeriodQuery }) {
  const { shop } = row
  const params = new URLSearchParams(periodLinkParams(period))
  if (search) params.set('q', search)
  const ordersHref = `/orders/${shop.id}${params.size ? `?${params}` : ''}`

  return (
    <tr>
      <td>
        <div className={table.stack}>
          <Link className={table.primary} to={`/vendors/${shop.id}`}>
            {shop.name}
          </Link>
          <span className={table.secondary}>{shop.ref}</span>
        </div>
      </td>
      <td>{shop.market ?? <span className={table.muted}>Not set</span>}</td>
      <td>
        <StatusBadge status={shop.status} />
      </td>
      <td>
        <div className={table.stack}>
          <span>{row.orders}</span>
          {row.cancelled > 0 && <span className={`${table.secondary} ${table.nowrap}`}>{row.cancelled} cancelled</span>}
        </div>
      </td>
      <td className={row.open ? table.warning : table.muted}>{row.open}</td>
      <td className={table.nowrap}>{formatCedis(row.deliveredSales)}</td>
      <td className={`${table.nowrap} ${table.muted}`}>{row.lastOrderAt ? formatTimeAgo(row.lastOrderAt) : '—'}</td>
      <td className={table.actionCell}>
        <Link className={table.rowButton} to={ordersHref}>
          View orders
        </Link>
      </td>
    </tr>
  )
}
