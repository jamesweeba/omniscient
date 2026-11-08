import { useCallback } from 'react'
import { Link, useNavigate } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAsync } from '@/hooks/useAsync'
import { usePageTitle } from '@/hooks/usePageTitle'
import { pageParam, useSearchParamInput, useUrlParams } from '@/hooks/useUrlState'
import { formatDateTime, formatCedis } from '@/lib/format'
import { isHiddenBuyer, ORDER_STATUS } from '@/lib/orderDisplay'
import { fetchMyOrders, type Order, type OrderStatus } from '@/lib/orders'
import { formatPhone } from '@/lib/phone'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import panel from '../DataPanel.module.css'
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
  usePageTitle('Orders')
  const { shop } = useVendorPortal()
  const [params, update] = useUrlParams()
  const [search, setSearch, committedSearch] = useSearchParamInput(params, update)
  const status = FILTERS.find((f) => f.status === params.get('status'))?.status ?? null
  const page = pageParam(params)

  const load = useCallback(
    () => fetchMyOrders({ status: status ?? undefined, search: committedSearch || undefined, page, pageSize: PAGE_SIZE }),
    [status, committedSearch, page],
  )
  const orders = useAsync(load, { live: true })
  if (!shop) return null

  const data = orders.status === 'success' ? orders.data : null
  const filtered = Boolean(status || committedSearch)

  return (
    <>
      <VendorPageHeader
        title="Orders"
        lead={
          shop.status === 'ACTIVE'
            ? 'Orders from buyers on WhatsApp. Open one to pack it, send a rider or mark it delivered.'
            : 'Buyers can order once your shop is live. You can still add orders that come by phone.'
        }
        actions={
          <Link className={styles.secondary} to="/vendor/orders/new">
            Add phone order
          </Link>
        }
      />

      <section className={panel.panel} aria-label="Your orders">
        <div className={list.tabs} role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              className={f.status === status ? `${list.tab} ${list.tabActive}` : list.tab}
              type="button"
              aria-pressed={f.status === status}
              onClick={() => update({ status: f.status, page: null })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className={panel.toolbar}>
          <input
            className={`${styles.input} ${panel.search}`}
            type="search"
            placeholder="Search orders"
            aria-label="Search orders"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {data && <span className={styles.muted}>{data.total === 1 ? '1 order' : `${data.total} orders`}</span>}
        </div>

        {orders.status === 'loading' && <p className={styles.centered}>Loading…</p>}
        {orders.status === 'error' && <p className={`${styles.alertError} ${panel.inset}`}>{orders.error}</p>}
        {data &&
          (data.items.length === 0 ? (
            <p className={styles.centered}>{filtered ? 'No orders match.' : 'No orders yet.'}</p>
          ) : (
            <table className={`${panel.table} ${list.table}`} aria-busy={orders.isFetching}>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Buyer</th>
                  <th scope="col">Items</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={list.right}>
                    Total
                  </th>
                  <th scope="col">Placed</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </tbody>
            </table>
          ))}

        {data && data.total > PAGE_SIZE && (
          <div className={panel.footer}>
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={(next) => update({ page: String(next) })} />
          </div>
        )}
      </section>
    </>
  )
}

function OrderRow({ order }: { order: Order }) {
  const navigate = useNavigate()
  const status = ORDER_STATUS[order.status]
  const items = order.items.map((i) => (i.quantity > 1 ? `${i.productName} ×${i.quantity}` : i.productName)).join(', ')
  const buyer = order.customerName ?? (isHiddenBuyer(order.buyerPhone) ? 'Buyer' : formatPhone(order.buyerPhone, 'local'))
  const to = `/vendor/orders/${order.id}`

  return (
    // The whole row opens the order; the order number is the real link for keyboards and screen readers.
    <tr className={list.row} onClick={() => navigate(to)}>
      <td className={list.numberCell}>
        <Link to={to} onClick={(e) => e.stopPropagation()}>
          {order.orderNumber}
        </Link>
      </td>
      <td className={list.buyerCell}>{buyer}</td>
      <td className={list.itemsCell}>{items}</td>
      <td className={list.statusCell}>
        <Badge tone={status.tone}>{status.label}</Badge>
      </td>
      <td className={`${list.right} ${list.totalCell}`}>{formatCedis(order.totalAmount)}</td>
      <td className={list.dateCell}>{formatDateTime(order.createdAt)}</td>
    </tr>
  )
}
