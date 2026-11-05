import { Fragment, useState, type ReactNode } from 'react'
import { Badge } from '@/components/Badge/Badge'
import { formatCedis, formatDateTime } from '@/lib/format'
import { FULFILLMENT, isHiddenBuyer, ORDER_STATUS, PAYMENT_METHOD } from '@/lib/orderDisplay'
import type { OrderListItem } from '@/lib/orders'
import { formatPhone } from '@/lib/phone'
import table from '@/styles/table.module.css'
import { OrderDetail } from './OrderDetail'
import styles from './VendorOrders.module.css'

const COLUMN_COUNT = 8

interface OrdersTableProps {
  orders: OrderListItem[]
  emptyMessage: ReactNode
}

export function OrdersTable({ orders, emptyMessage }: OrdersTableProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className={table.scroll}>
      <table className={table.table}>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Items</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Delivery</th>
            <th>
              <span className={table.visuallyHidden}>Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td className={table.emptyCell} colSpan={COLUMN_COUNT}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                open={openId === order.id}
                onToggle={() => setOpenId((current) => (current === order.id ? null : order.id))}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

/** A buyer's phone, or "Hidden number" for buyers who hide it. */
export function BuyerPhone({ phone }: { phone: string }) {
  return isHiddenBuyer(phone) ? <span title={phone}>Hidden number</span> : <>{formatPhone(phone)}</>
}

function OrderRow({ order, open, onToggle }: { order: OrderListItem; open: boolean; onToggle: () => void }) {
  const status = ORDER_STATUS[order.status]
  const detailId = `order-${order.id}`

  return (
    <Fragment>
      <tr className={open ? styles.rowOpen : styles.clickableRow} onClick={onToggle}>
        <td>
          <div className={table.stack}>
            <span className={`${table.primary} ${table.nowrap}`}>{order.orderNumber}</span>
            <span className={`${table.secondary} ${table.nowrap}`}>{formatDateTime(order.createdAt)}</span>
          </div>
        </td>
        <td>
          <div className={table.stack}>
            <span>{order.customerName ?? '—'}</span>
            <span className={`${table.secondary} ${table.nowrap}`}>
              <BuyerPhone phone={order.buyerPhone} />
            </span>
          </div>
        </td>
        <td>
          <Badge tone={status.tone}>{status.label}</Badge>
        </td>
        <td>{order.itemCount}</td>
        <td className={`${table.nowrap} ${table.primary}`}>{formatCedis(order.totalAmount)}</td>
        <td className={table.nowrap}>{order.paymentMethod ? PAYMENT_METHOD[order.paymentMethod] : '—'}</td>
        <td>
          <div className={table.stack}>
            <span>{order.fulfillment ? FULFILLMENT[order.fulfillment] : '—'}</span>
            {order.fulfillment !== 'PICKUP' && order.deliveryArea && <span className={table.secondary}>{order.deliveryArea}</span>}
          </div>
        </td>
        <td className={table.actionCell}>
          <button
            className={styles.expandButton}
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {open ? 'Hide' : 'Details'}
            <svg
              className={open ? styles.chevronOpen : styles.chevron}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </td>
      </tr>
      {open && (
        <tr id={detailId} className={styles.detailRow}>
          <td colSpan={COLUMN_COUNT}>
            <OrderDetail orderId={order.id} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}
