import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAsync } from '@/hooks/useAsync'
import { formatPrice } from '@/lib/format'
import { PAYMENT_METHOD } from '@/lib/orderDisplay'
import { createOrder, type Fulfillment, type PaymentMethod } from '@/lib/orders'
import { parseGhanaPhone } from '@/lib/phone'
import { fetchShop, isReadOnly } from '@/lib/vendorPortal'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import view from './Orders.module.css'
import { LockNotice } from './VendorPageHeader'

interface ItemRow {
  key: number
  name: string
  price: string
  quantity: string
}

let nextKey = 1
const newItem = (): ItemRow => ({ key: nextKey++, name: '', price: '', quantity: '1' })

/** An order that came in by phone or in person; the server works out the totals. */
export function NewOrder() {
  const { shop } = useVendorPortal()
  const details = useAsync(fetchShop)
  if (!shop) return null

  return (
    <>
      <Link className={styles.backLink} to="/vendor/orders">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Orders
      </Link>
      <div className={styles.heading}>
        <h1 className={styles.title}>Add a phone order</h1>
        <p className={styles.lead}>For orders a buyer gave you by phone or at your stall.</p>
      </div>
      {isReadOnly(shop.status) ? (
        <LockNotice status={shop.status} what="your orders" />
      ) : details.status === 'success' ? (
        <NewOrderForm defaultFee={details.data.deliveryFee} />
      ) : details.status === 'error' ? (
        <p className={styles.alertError}>{details.error}</p>
      ) : (
        <p className={styles.centered}>Loading…</p>
      )}
    </>
  )
}

function NewOrderForm({ defaultFee }: { defaultFee: number }) {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [items, setItems] = useState<ItemRow[]>(() => [newItem()])
  const [payment, setPayment] = useState<PaymentMethod>('COD')
  const [fulfillment, setFulfillment] = useState<Fulfillment>('DELIVERY')
  const [address, setAddress] = useState('')
  const [fee, setFee] = useState(String(defaultFee))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const delivery = fulfillment === 'DELIVERY'
  const itemsTotal = items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
  const total = itemsTotal + (delivery ? Number(fee) || 0 : 0)

  const changeItem = (key: number, changes: Partial<ItemRow>) =>
    setItems((current) => current.map((i) => (i.key === key ? { ...i, ...changes } : i)))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseGhanaPhone(phone)
    const filled = items.filter((i) => i.name.trim() || i.price.trim())
    if (!parsed) return setError('Enter the buyer’s phone, e.g. 0244 111 222.')
    if (filled.length === 0) return setError('Add at least one item.')
    if (filled.some((i) => !i.name.trim() || !(Number(i.price) >= 0) || i.price.trim() === '' || !(Number(i.quantity) >= 1))) {
      return setError('Every item needs a name, a price and a quantity of 1 or more.')
    }
    if (delivery && !(Number(fee) >= 0)) return setError('Enter the delivery fee (0 or more).')

    setPending(true)
    setError(null)
    try {
      const order = await createOrder({
        buyerPhone: parsed.local.replace(/\s/g, ''),
        items: filled.map((i) => ({ productName: i.name.trim(), unitPrice: Number(i.price), quantity: Math.round(Number(i.quantity)) })),
        paymentMethod: payment,
        fulfillment,
        deliveryAddress: delivery && address.trim() ? address.trim() : undefined,
        deliveryFee: delivery ? Number(fee) : 0,
        notes: notes.trim() || undefined,
      })
      navigate(`/vendor/orders/${order.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPending(false)
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <fieldset className={styles.fieldset} disabled={pending}>
        <label className={styles.field}>
          Buyer’s phone
          <input className={styles.input} type="tel" inputMode="tel" placeholder="0244 111 222" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>

        <div className={styles.field} role="group" aria-labelledby="order-items">
          <span id="order-items">Items</span>
          {items.map((item, index) => (
            <div key={item.key} className={view.itemRow}>
              <input className={styles.input} aria-label={`Item ${index + 1}`} placeholder="Tomatoes" value={item.name} onChange={(e) => changeItem(item.key, { name: e.target.value })} />
              <input className={styles.input} aria-label={`Item ${index + 1} price in cedis`} type="number" inputMode="decimal" min={0} step="0.01" placeholder="GH₵" value={item.price} onChange={(e) => changeItem(item.key, { price: e.target.value })} />
              <input className={styles.input} aria-label={`Item ${index + 1} quantity`} type="number" inputMode="numeric" min={1} step={1} value={item.quantity} onChange={(e) => changeItem(item.key, { quantity: e.target.value })} />
              <button type="button" aria-label={`Remove item ${index + 1}`} onClick={() => setItems((current) => (current.length > 1 ? current.filter((i) => i.key !== item.key) : [newItem()]))}>
                ✕
              </button>
            </div>
          ))}
          <button className={styles.textButton} type="button" onClick={() => setItems((current) => [...current, newItem()])}>
            + Add another item
          </button>
        </div>

        <div className={styles.field} role="radiogroup" aria-label="Delivery or pickup">
          <span>Delivery or pickup</span>
          <div className={styles.choices}>
            {(['DELIVERY', 'PICKUP'] as const).map((f) => (
              <label key={f} className={styles.choice}>
                <input type="radio" name="fulfillment" checked={fulfillment === f} onChange={() => setFulfillment(f)} />
                {f === 'DELIVERY' ? 'Deliver to the buyer' : 'Buyer picks it up'}
              </label>
            ))}
          </div>
        </div>

        {delivery && (
          <>
            <label className={styles.field}>
              <span>
                Delivery address <span className={styles.optional}>· optional</span>
              </span>
              <input className={styles.input} placeholder="KNUST — Unity Hall, Block C" value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            <label className={styles.field}>
              Delivery fee (GH₵)
              <input className={styles.input} type="number" inputMode="decimal" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} />
            </label>
          </>
        )}

        <label className={styles.field}>
          Payment
          <select className={styles.select} value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD[m]}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>
            Notes <span className={styles.optional}>· optional</span>
          </span>
          <input className={styles.input} placeholder="Call before coming" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </fieldset>

      <p className={styles.muted}>Total about {formatPrice(total)}. We work out the exact total when you save.</p>
      {error && (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      )}
      <button className={styles.primary} type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save order'}
      </button>
    </form>
  )
}
