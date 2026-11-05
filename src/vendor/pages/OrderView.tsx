import { useCallback, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import { useAsync } from '@/hooks/useAsync'
import { formatDateTime, formatPrice, whatsAppLink } from '@/lib/format'
import { FULFILLMENT, isHiddenBuyer, mapLink, ORDER_STATUS, ORDER_STATUSES, PAYMENT_METHOD, riderMessage, whatsAppMessageLink } from '@/lib/orderDisplay'
import { deleteOrder, fetchMyOrder, updateOrderStatus, type Order, type OrderStatus, type StatusChange } from '@/lib/orders'
import { formatPhone, parseGhanaPhone } from '@/lib/phone'
import { isReadOnly, type TenantStatus } from '@/lib/vendorPortal'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import view from './Orders.module.css'
import { LockNotice } from './VendorPageHeader'

/** Statuses that mean the order is paid (or past payment). */
const PAID_STATUSES: OrderStatus[] = ['PAID', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED']

/**
 * The buyer was sent a Paystack MoMo prompt and hasn't paid yet: only Paystack can mark the
 * order paid (the server refuses it by hand), so the vendor waits or cancels.
 */
const waitingForPaystack = (order: Order) =>
  order.paymentMethod !== 'COD' && Boolean(order.paymentRequestedAt) && !order.paystackPaidAt && !PAID_STATUSES.includes(order.status)

/** The one obvious next step for an order, if there is one. */
function nextStep(order: Order): { status: OrderStatus; label: string; hint: string } | null {
  if (waitingForPaystack(order)) return null
  switch (order.status) {
    case 'PENDING':
      return { status: 'CONFIRMED', label: 'Confirm order', hint: 'Tell the buyer you have it.' }
    case 'PAID':
    case 'CONFIRMED':
      return { status: 'PROCESSING', label: 'Mark as packed', hint: 'The buyer gets a WhatsApp message that it’s packed.' }
    case 'PROCESSING':
      return order.fulfillment === 'PICKUP'
        ? { status: 'DELIVERED', label: 'Mark as collected', hint: 'The buyer picked it up.' }
        : { status: 'OUT_FOR_DELIVERY', label: 'Send rider', hint: 'The buyer gets the rider’s name and phone on WhatsApp.' }
    case 'OUT_FOR_DELIVERY':
      return { status: 'DELIVERED', label: 'Mark delivered', hint: 'The buyer gets a WhatsApp message.' }
    default:
      return null
  }
}

export function OrderView() {
  const { orderId = '' } = useParams()
  const { shop } = useVendorPortal()
  const load = useCallback(() => fetchMyOrder(orderId), [orderId])
  const result = useAsync(load)
  if (!shop) return null

  return (
    <>
      <Link className={styles.backLink} to="/vendor/orders">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Orders
      </Link>
      {result.status === 'loading' && <p className={styles.centered}>Loading order…</p>}
      {result.status === 'error' && <p className={styles.alertError}>{result.error}</p>}
      {result.status === 'success' && (
        <OrderContent
          key={result.data.id}
          initial={result.data}
          shopName={shop.number?.displayName ?? null}
          readOnly={isReadOnly(shop.status)}
          lockStatus={shop.status}
        />
      )}
    </>
  )
}

interface OrderContentProps {
  initial: Order
  /** The shop's WhatsApp display name, for the rider message. */
  shopName: string | null
  readOnly: boolean
  lockStatus: TenantStatus
}

/** Orders still with the rider; afterwards there's nothing to send them. */
const RIDER_STATUSES: OrderStatus[] = ['PAID', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY']

function OrderContent({ initial, shopName, readOnly, lockStatus }: OrderContentProps) {
  const navigate = useNavigate()
  const [order, setOrder] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  // Where the rider form is open: under the next-step button or under the status menu.
  const [riderForm, setRiderForm] = useState<'next' | 'menu' | null>(null)
  const [menuStatus, setMenuStatus] = useState<OrderStatus>(order.status)

  const status = ORDER_STATUS[order.status]
  const next = nextStep(order)
  const lockedToPaystack = waitingForPaystack(order)
  const awaitingMomo = order.status === 'AWAITING_PAYMENT' || (lockedToPaystack && order.status === 'PENDING')
  const map = mapLink(order)
  const subtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0)
  const canSendRider = Boolean(order.riderPhone) && order.fulfillment !== 'PICKUP' && RIDER_STATUSES.includes(order.status)

  async function change(input: StatusChange) {
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await updateOrderStatus(order.id, input)
      // Some responses leave out the items; keep the ones we have.
      setOrder((current) => ({ ...current, ...updated, items: updated.items ?? current.items }))
      setMenuStatus(input.status)
      setRiderForm(null)
      setMessage(
        input.status === 'OUT_FOR_DELIVERY' && order.fulfillment !== 'PICKUP'
          ? `Marked as “${ORDER_STATUS[input.status].label}”. Now send the delivery details to your rider (under Delivery).`
          : `Marked as “${ORDER_STATUS[input.status].label}”.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete order ${order.orderNumber}? This can’t be undone.`)) return
    setPending(true)
    try {
      await deleteOrder(order.id)
      navigate('/vendor/orders')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t delete it. Please try again.')
      setPending(false)
    }
  }

  return (
    <>
      <div className={styles.heading}>
        <h1 className={styles.title}>{order.orderNumber}</h1>
        <p className={styles.lead}>
          <Badge tone={status.tone}>{status.label}</Badge> · {formatDateTime(order.createdAt)}
        </p>
      </div>
      {readOnly && <LockNotice status={lockStatus} what="your orders" />}

      {!readOnly && (next || awaitingMomo) && (
        <section className={`${styles.card} ${view.nextStep}`} aria-label="Next step">
          {awaitingMomo ? (
            <p className={styles.muted}>
              Waiting for the buyer to approve the MoMo payment on their phone. The order changes to Paid by itself once they do; don’t pack it before then.
            </p>
          ) : (
            next &&
            (riderForm === 'next' ? (
              <RiderForm pending={pending} onCancel={() => setRiderForm(null)} onSubmit={(rider) => change({ status: 'OUT_FOR_DELIVERY', ...rider })} />
            ) : (
              <>
                <button
                  className={styles.primary}
                  type="button"
                  disabled={pending}
                  onClick={() => (next.status === 'OUT_FOR_DELIVERY' ? setRiderForm('next') : change({ status: next.status }))}
                >
                  {pending ? 'Saving…' : next.label}
                </button>
                <span className={styles.fieldHint}>{next.hint}</span>
              </>
            ))
          )}
        </section>
      )}
      {message && <p className={styles.alertSuccess} role="status">{message}</p>}
      {error && <p className={styles.alertError} role="alert">{error}</p>}

      <section className={styles.card} aria-labelledby="items">
        <h2 id="items" className={styles.cardTitle}>
          Items
        </h2>
        <table className={view.lines}>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.productName}
                  <br />
                  <span className={styles.muted}>
                    {item.quantity} × {formatPrice(item.unitPrice)}
                  </span>
                </td>
                <td>{formatPrice(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Items</td>
              <td>{formatPrice(subtotal)}</td>
            </tr>
            <tr>
              <td>Delivery</td>
              <td>{formatPrice(order.deliveryFee)}</td>
            </tr>
            <tr className={view.total}>
              <td>Total</td>
              <td>{formatPrice(order.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className={styles.card} aria-labelledby="buyer">
        <h2 id="buyer" className={styles.cardTitle}>
          Buyer
        </h2>
        <dl className={view.facts}>
          <Fact label="Name">{order.customerName ?? '—'}</Fact>
          <Fact label="WhatsApp">
            {isHiddenBuyer(order.buyerPhone) ? (
              'Number hidden by the buyer'
            ) : (
              <a href={whatsAppLink(order.buyerPhone)} target="_blank" rel="noreferrer">
                {formatPhone(order.buyerPhone, 'local')}
              </a>
            )}
          </Fact>
          {order.contactPhone && (
            <Fact label="Call">
              <a href={`tel:${order.contactPhone}`}>{formatPhone(order.contactPhone, 'local')}</a>
            </Fact>
          )}
          {order.notes && <Fact label="Notes">{order.notes}</Fact>}
        </dl>
      </section>

      <section className={styles.card} aria-labelledby="delivery">
        <h2 id="delivery" className={styles.cardTitle}>
          {order.fulfillment ? FULFILLMENT[order.fulfillment] : 'Delivery'}
        </h2>
        <dl className={view.facts}>
          {order.fulfillment !== 'PICKUP' && (
            <Fact label="Where">{order.deliveryAddress ?? ([order.deliveryArea, order.landmark].filter(Boolean).join(' — ') || '—')}</Fact>
          )}
          {order.deliverySlot && <Fact label="When">{order.deliverySlot}</Fact>}
          {(order.riderName || order.riderPhone) && (
            <Fact label="Rider">{[order.riderName, order.riderPhone && formatPhone(order.riderPhone, 'local')].filter(Boolean).join(' · ')}</Fact>
          )}
          {order.deliveryConfirmedAt && <Fact label="Received">Buyer confirmed on WhatsApp, {formatDateTime(order.deliveryConfirmedAt)}</Fact>}
          <Fact label="Payment">
            {order.paymentMethod ? PAYMENT_METHOD[order.paymentMethod] : '—'}
            {order.paymentMethod === 'COD' && ` · collect ${formatPrice(order.totalAmount)}`}
          </Fact>
        </dl>
        {map && order.locationLatitude != null && order.locationLongitude != null && (
          <>
            <iframe
              className={view.map}
              title="Buyer’s map pin"
              loading="lazy"
              src={osmEmbed(order.locationLatitude, order.locationLongitude)}
            />
            <a className={styles.secondary} href={map} target="_blank" rel="noreferrer">
              Open in Maps{order.locationName ? ` · ${order.locationName}` : ''}
            </a>
          </>
        )}
        {canSendRider && (
          <div className={view.riderShare}>
            <a
              className={styles.primary}
              href={whatsAppMessageLink(order.riderPhone!, riderMessage(order, shopName))}
              target="_blank"
              rel="noreferrer"
            >
              Send delivery details to {order.riderName || 'rider'} on WhatsApp
            </a>
            <span className={styles.fieldHint}>
              {map
                ? `Opens WhatsApp with the buyer’s map pin, phone and what to collect, ready to send to ${formatPhone(order.riderPhone!, 'local')}. Check the number, then tap send.`
                : `The buyer hasn’t shared their map pin yet, so the message has their area only. Send it again once the pin arrives.`}
            </span>
          </div>
        )}
      </section>

      {!readOnly && (
        <section className={styles.card} aria-labelledby="more">
          <h2 id="more" className={styles.cardTitle}>
            Change status
          </h2>
          <div className={styles.inline}>
            <select className={styles.select} aria-label="Status" value={menuStatus} disabled={pending} onChange={(e) => setMenuStatus(e.target.value as OrderStatus)}>
              {ORDER_STATUSES.map((s) => {
                const locked = lockedToPaystack && PAID_STATUSES.includes(s)
                return (
                  <option key={s} value={s} disabled={locked}>
                    {ORDER_STATUS[s].label}
                    {locked ? ' (after payment)' : ''}
                  </option>
                )
              })}
            </select>
            <button
              className={`${styles.secondary} ${styles.small}`}
              type="button"
              disabled={pending || menuStatus === order.status}
              onClick={() => (menuStatus === 'OUT_FOR_DELIVERY' ? setRiderForm('menu') : change({ status: menuStatus }))}
            >
              Update
            </button>
          </div>
          {lockedToPaystack && (
            <span className={styles.fieldHint}>The buyer got a MoMo prompt, so only Paystack can mark this order paid. You can still cancel it.</span>
          )}
          {riderForm === 'menu' && (
            <RiderForm pending={pending} onCancel={() => setRiderForm(null)} onSubmit={(rider) => change({ status: 'OUT_FOR_DELIVERY', ...rider })} />
          )}
          <button className={styles.dangerText} type="button" disabled={pending} onClick={handleDelete}>
            Delete this order
          </button>
        </section>
      )}
    </>
  )
}

/** Asks for the rider's name and phone before marking an order as on the way. */
function RiderForm({ pending, onCancel, onSubmit }: { pending: boolean; onCancel: () => void; onSubmit: (rider: { riderName: string; riderPhone: string }) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseGhanaPhone(phone)
    if (!name.trim()) return setError('Enter the rider’s name.')
    if (!parsed) return setError('Enter the rider’s phone, e.g. 0244 000 000.')
    onSubmit({ riderName: name.trim(), riderPhone: parsed.local.replace(/\s/g, '') })
  }

  return (
    <form className={view.nextStep} onSubmit={handleSubmit} noValidate>
      <label className={styles.field}>
        Rider’s name
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className={styles.field}>
        Rider’s phone
        <input className={styles.input} type="tel" inputMode="tel" placeholder="0244 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <span className={styles.fieldHint}>The buyer gets these on WhatsApp.</span>
      {error && <span className={styles.fieldError}>{error}</span>}
      <button className={styles.primary} type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send rider'}
      </button>
      <button className={styles.textButton} type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}

/** OpenStreetMap embed with a marker (no API key needed). */
function osmEmbed(lat: number, lng: number): string {
  const d = 0.004
  const bbox = [lng - d, lat - d, lng + d, lat + d].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
