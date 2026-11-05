import { useCallback, useEffect } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAsync } from '@/hooks/useAsync'
import { pageParam, useSearchParamInput, useUrlParams } from '@/hooks/useUrlState'
import { onDataChanged } from '@/lib/dataEvents'
import { formatDateTime, formatPrice } from '@/lib/format'
import { isHiddenBuyer, ORDER_STATUS } from '@/lib/orderDisplay'
import { fetchMyOrders, type Order, type OrderStatus } from '@/lib/orders'
import { formatPhone } from '@/lib/phone'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import list from './Orders.module.css'
import { VendorPageHeader } from './VendorPageHeader'

const PAGE_SIZE = 10

/** Filter chips; the API filters by one status at a time. */
const FILTERS: { status: OrderStatus | null; label: string }[] = [
  { status: null, label: 'All' },
  { status: 'PAID', label: 'Paid' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'AWAITING_PAYMENT', label: 'Waiting for MoMo' },
  { status: 'PROCESSING', label: 'Packed' },
  { status: 'OUT_FOR_DELIVERY', label: 'On the way' },
  { status: 'DELIVERED', label: 'Delivered' },
  { status: 'CANCELLED', label: 'Cancelled' },
]

export function Orders() {
  const { shop } = useVendorPortal()
  const [params, update] = useUrlParams()
  const [search, setSearch, committedSearch] = useSearchParamInput(params, update)
  const status = FILTERS.find((f) => f.status === params.get('status'))?.status ?? null
  const page = pageParam(params)

  const load = useCallback(
    () => fetchMyOrders({ status: status ?? undefined, search: committedSearch || undefined, page, pageSize: PAGE_SIZE }),
    [status, committedSearch, page],
  )
  const orders = useAsync(load)
  const { reload } = orders
  useEffect(() => onDataChanged(reload), [reload])
  if (!shop) return null

  const data = orders.status === 'success' ? orders.data : null
  const filtered = Boolean(status || committedSearch)

  return (
    <>
      <VendorPageHeader
        title="Orders"
        lead={
          shop.status === 'ACTIVE'
            ? 'Orders from buyers on WhatsApp. Tap one to pack it, send a rider or mark it delivered.'
            : 'Buyers can order once your shop is live. You can still add orders that come by phone.'
        }
        noBack
      />

      <div className={list.addRow}>
        <Link className={styles.secondary} to="/vendor/orders/new">
          Add a phone order
        </Link>
      </div>

      <section className={styles.card} aria-label="Your orders">
        <input
          className={styles.input}
          type="search"
          placeholder="Order number, phone or note"
          aria-label="Search orders"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={list.chips} role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              className={f.status === status ? list.chipActive : list.chip}
              type="button"
              aria-pressed={f.status === status}
              onClick={() => update({ status: f.status, page: null })}
            >
              {f.label}
            </button>
          ))}
        </div>

        {orders.status === 'loading' && <p className={styles.centered}>Loading…</p>}
        {orders.status === 'error' && <p className={styles.alertError}>{orders.error}</p>}
        {data &&
          (data.items.length === 0 ? (
            <p className={styles.centered}>{filtered ? 'No orders match.' : 'No orders yet.'}</p>
          ) : (
            <ul className={list.orders} aria-busy={orders.isFetching}>
              {data.items.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </ul>
          ))}

        {data && data.total > PAGE_SIZE && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={(next) => update({ page: String(next) })} />
        )}
      </section>
    </>
  )
}

function OrderCard({ order }: { order: Order }) {
  const status = ORDER_STATUS[order.status]
  const items = order.items.map((i) => (i.quantity > 1 ? `${i.productName} ×${i.quantity}` : i.productName)).join(', ')
  const buyer = order.customerName ?? (isHiddenBuyer(order.buyerPhone) ? 'Buyer' : formatPhone(order.buyerPhone, 'local'))

  return (
    <li>
      <Link className={list.order} to={`/vendor/orders/${order.id}`}>
        <span className={list.orderTop}>
          <span className={list.orderNumber}>{order.orderNumber}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
        <span className={list.orderBuyer}>
          {buyer} · <strong>{formatPrice(order.totalAmount)}</strong>
        </span>
        {items && <span className={list.orderItems}>{items}</span>}
        <span className={list.orderMeta}>{formatDateTime(order.createdAt)}</span>
      </Link>
    </li>
  )
}
