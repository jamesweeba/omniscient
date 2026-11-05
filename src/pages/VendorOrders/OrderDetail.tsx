import { useCallback } from 'react'
import { Fact } from '@/components/Fact/Fact'
import { useAction } from '@/hooks/useAction'
import { useAsync } from '@/hooks/useAsync'
import { cedis, formatCedis, formatDateTime, formatStars, whatsAppLink } from '@/lib/format'
import { deliveryPlace, FULFILLMENT, isHiddenBuyer, mapLink, ORDER_STATUS, orderSubtotal, PAYMENT_METHOD, riderText } from '@/lib/orderDisplay'
import { fetchAdminOrder, type Order } from '@/lib/orders'
import { releaseOrderPayout } from '@/lib/payouts'
import { formatPhone } from '@/lib/phone'
import { BuyerPhone } from './OrdersTable'
import styles from './VendorOrders.module.css'

/** One order, loaded when its row is opened: items, buyer, delivery, payment, rider. Read-only. */
export function OrderDetail({ orderId }: { orderId: string }) {
  const load = useCallback(() => fetchAdminOrder(orderId), [orderId])
  const result = useAsync(load)

  if (result.status === 'loading') return <p className={styles.muted}>Loading order…</p>
  if (result.status === 'error') return <p className={styles.muted}>{result.error}</p>
  const order = result.data
  const subtotal = orderSubtotal(order)
  const map = mapLink(order)

  return (
    <div className={styles.detail}>
      <section className={styles.detailItems} aria-label="Items">
        <h3 className={styles.detailTitle}>Items</h3>
        <table className={styles.compactTable}>
          <thead>
            <tr>
              <th>Product</th>
              <th className={styles.alignRight}>Qty</th>
              <th className={styles.alignRight}>Unit price</th>
              <th className={styles.alignRight}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className={styles.strong}>{item.productName}</td>
                <td className={styles.alignRight}>{item.quantity}</td>
                <td className={styles.alignRight}>{formatCedis(item.unitPrice)}</td>
                <td className={styles.alignRight}>{formatCedis(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Subtotal</td>
              <td className={styles.alignRight}>{formatCedis(subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3}>Delivery</td>
              <td className={styles.alignRight}>{formatCedis(order.deliveryFee)}</td>
            </tr>
            <tr className={styles.totalRow}>
              <td colSpan={3}>Total</td>
              <td className={styles.alignRight}>{formatCedis(order.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
        <p className={styles.subtle}>
          {ORDER_STATUS[order.status].label} · placed {formatDateTime(order.createdAt)}
          {order.updatedAt && ` · updated ${formatDateTime(order.updatedAt)}`}
        </p>
      </section>

      <div className={styles.detailSide}>
        <section aria-label="Buyer">
          <h3 className={styles.detailTitle}>Buyer</h3>
          <dl className={styles.facts}>
            <Fact label="Name">{order.customerName ?? '—'}</Fact>
            <Fact label="WhatsApp">
              {isHiddenBuyer(order.buyerPhone) ? (
                <BuyerPhone phone={order.buyerPhone} />
              ) : (
                <a href={whatsAppLink(order.buyerPhone)} target="_blank" rel="noreferrer">
                  <BuyerPhone phone={order.buyerPhone} />
                </a>
              )}
            </Fact>
            {order.contactPhone && <Fact label="Contact phone">{formatPhone(order.contactPhone)}</Fact>}
            {order.notes && <Fact label="Notes">{order.notes}</Fact>}
          </dl>
        </section>

        <section aria-label="Delivery">
          <h3 className={styles.detailTitle}>{order.fulfillment ? FULFILLMENT[order.fulfillment] : 'Delivery'}</h3>
          <DeliveryFacts order={order} map={map} />
        </section>

        <section aria-label="Payment">
          <h3 className={styles.detailTitle}>Payment</h3>
          <dl className={styles.facts}>
            <Fact label="Method">{order.paymentMethod ? PAYMENT_METHOD[order.paymentMethod] : '—'}</Fact>
            {order.paymentPhone && (
              <Fact label="MoMo number">
                {formatPhone(order.paymentPhone)}
                {order.momoNetwork && ` · ${order.momoNetwork.toUpperCase()}`}
              </Fact>
            )}
            <VendorPayoutFact order={order} onReleased={result.reload} />
          </dl>
        </section>
      </div>
    </div>
  )
}

function DeliveryFacts({ order, map }: { order: Order; map: string | null }) {
  return (
    <dl className={styles.facts}>
      {order.fulfillment !== 'PICKUP' && (
        <Fact label="Address">{deliveryPlace(order) || '—'}</Fact>
      )}
      {order.deliverySlot && <Fact label="When">{order.deliverySlot}</Fact>}
      {map && (
        <Fact label="Map pin">
          <a href={map} target="_blank" rel="noreferrer">
            {order.locationName ?? order.locationAddress ?? 'Open in Maps'}
          </a>
        </Fact>
      )}
      {(order.riderName || order.riderPhone) && (
        <Fact label="Rider">{riderText(order, 'international')}</Fact>
      )}
      {order.deliveryConfirmedAt && <Fact label="Received">Buyer confirmed on WhatsApp, {formatDateTime(order.deliveryConfirmedAt)}</Fact>}
      {order.buyerRating && (
        <Fact label="Buyer rating">
          <span aria-label={`${order.buyerRating} out of 5 stars`}>
            {formatStars(order.buyerRating)}
          </span>
        </Fact>
      )}
    </dl>
  )
}

/** What this order means for the vendor's payout, with "Release" when only the buyer's tap is missing. */
function VendorPayoutFact({ order, onReleased }: { order: Order; onReleased: () => void }) {
  const { pending, error, run } = useAction()
  const delivered = order.status === 'DELIVERED' || order.status === 'COMPLETED'
  const { settlement } = order

  if (settlement?.type === 'ORDER_EARNING') {
    return <Fact label="Vendor payout">{cedis(settlement.amount)} credited to the vendor, {formatDateTime(settlement.createdAt)}</Fact>
  }
  if (settlement?.type === 'CASH_COMMISSION') {
    return <Fact label="Commission">{cedis(-settlement.amount)} owed by the vendor (cash order), taken off their balance</Fact>
  }
  if (order.paymentMethod === 'COD' || !order.paystackPaidAt) return null
  if (!delivered) return <Fact label="Vendor payout">Paid by the buyer; the vendor is paid once the buyer confirms delivery</Fact>

  function release() {
    if (!window.confirm(`Pay the vendor for ${order.orderNumber} without the buyer’s confirmation? Only do this if you’ve checked the buyer got it.`)) return
    void run(
      async () => {
        await releaseOrderPayout(order.id)
        onReleased()
      },
      { fallback: 'Couldn’t release it. Please try again.', keepPendingOnSuccess: true },
    )
  }

  return (
    <Fact label="Vendor payout">
      Waiting for the buyer to tap “I got my order”.{' '}
      <button className={styles.inlineButton} type="button" disabled={pending} onClick={release}>
        {pending ? 'Releasing…' : 'Release to vendor'}
      </button>
      {error && <span className={styles.inlineError} role="alert"> {error}</span>}
    </Fact>
  )
}

