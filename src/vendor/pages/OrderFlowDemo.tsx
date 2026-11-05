import { useEffect, useState } from 'react'
import styles from './OrderFlowDemo.module.css'

/**
 * The story the hero tells, as buyers really order: a WhatsApp Flow (an in-chat form).
 * Each step is how long it stays on screen before the next.
 */
const STEPS = [
  { name: 'invite', ms: 1500 }, // shop's message with the "Order now" button
  { name: 'tap', ms: 600 }, // buyer taps it
  { name: 'products', ms: 1000 }, // Flow opens on the product list
  { name: 'tomatoes', ms: 900 }, // Tomatoes ×2
  { name: 'onions', ms: 1300 }, // Onions ×1
  { name: 'delivery', ms: 1700 },
  { name: 'pay', ms: 1300 },
  { name: 'paying', ms: 700 }, // "Pay with MoMo" pressed
  { name: 'paid', ms: 900 }, // button turns into "Paid"
  { name: 'delivering', ms: 3400 }, // Flow closes; the delivery car drives to the buyer
  { name: 'delivered', ms: 3000 }, // car arrives; "Delivered"
] as const

type StepName = (typeof STEPS)[number]['name']

const PRODUCTS = [
  { name: 'Tomatoes', measure: 'Olonka', price: 15, qty: 2, from: 'tomatoes' as StepName },
  { name: 'Onions', measure: 'Bag', price: 300, qty: 1, from: 'onions' as StepName },
  { name: 'Pepper', measure: 'Olonka', price: 10, qty: 0, from: null },
]
const DELIVERY_FEE = 10
const SCREENS = ['Choose products', 'Delivery', 'Review and pay'] as const

/** A WhatsApp Flow order, then its delivery, on a loop (shown delivered, still, if motion is reduced). */
export function OrderFlowDemo() {
  const reducedMotion = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reducedMotion) return
    const timer = setTimeout(() => setIndex((i) => (i + 1) % STEPS.length), STEPS[index].ms)
    return () => clearTimeout(timer)
  }, [index, reducedMotion])

  const step = reducedMotion ? STEPS.findIndex((s) => s.name === 'delivered') : index
  const reached = (name: StepName) => step >= STEPS.findIndex((s) => s.name === name)
  const at = (name: StepName) => STEPS[step].name === name

  const sheetOpen = reached('products') && !reached('delivering')
  const screen = reached('pay') ? 2 : reached('delivery') ? 1 : 0
  const qty = (product: (typeof PRODUCTS)[number]) => (product.from && reached(product.from) ? product.qty : 0)
  const subtotal = PRODUCTS.reduce((sum, p) => sum + qty(p) * p.price, 0)

  return (
    <div className={styles.demo} aria-hidden="true">
      <div className={styles.phone}>
        <div className={styles.chatHeader}>
          <span className={styles.avatar}>AS</span>
          <span className={styles.chatTitle}>
            <strong>Ama Serwaa Foods</strong>
            <span>on MarketiX · online</span>
          </span>
        </div>

        <div className={styles.chat}>
          <div className={styles.shopMessage}>
            <p>Hi Akua! Fresh stock in today. Tap below to order — we deliver.</p>
            <span className={at('tap') ? styles.ctaPressed : styles.cta}>
              <CartIcon />
              Order now
            </span>
          </div>
          {reached('delivering') && (
            <>
              <p className={styles.confirmation}>Thank you, Akua! Order MX-O-10422 is on its way.</p>
              <DeliveryTracker delivered={reached('delivered')} still={reducedMotion} />
            </>
          )}
        </div>

        {/* The Flow: a sheet over the chat, with screens that slide sideways. */}
        <div className={sheetOpen ? styles.sheetOpen : styles.sheet}>
          <div className={styles.sheetHeader}>
            <span className={styles.close}>✕</span>
            <strong>{SCREENS[screen]}</strong>
            <span className={styles.stepCount}>
              {screen + 1}/{SCREENS.length}
            </span>
          </div>

          <div className={styles.viewport}>
            <div className={styles.track} style={{ transform: `translateX(-${screen * 100}%)` }}>
              <div className={styles.screen}>
                {PRODUCTS.map((product) => (
                  <div key={product.name} className={styles.productRow}>
                    <span className={styles.productThumb} data-product={product.name} />
                    <span className={styles.productText}>
                      <strong>{product.name}</strong>
                      <span>
                        {product.measure} · GH₵ {product.price}
                      </span>
                    </span>
                    <span className={qty(product) ? styles.stepperActive : styles.stepper}>
                      <span>−</span>
                      <b key={qty(product)}>{qty(product)}</b>
                      <span>+</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className={styles.screen}>
                <span className={styles.label}>Deliver to</span>
                <span className={styles.select}>
                  Bantama <span>▾</span>
                </span>
                <span className={styles.label}>When</span>
                <span className={styles.radioOn}>As soon as possible</span>
                <span className={styles.radio}>Today, 14:00–16:00</span>
                <span className={styles.feeNote}>Delivery fee GH₵ {DELIVERY_FEE}</span>
              </div>

              <div className={styles.screen}>
                {PRODUCTS.filter((p) => p.qty).map((p) => (
                  <span key={p.name} className={styles.summaryRow}>
                    <span>
                      {p.name} · {p.measure} ×{p.qty}
                    </span>
                    <span>GH₵ {p.price * p.qty}</span>
                  </span>
                ))}
                <span className={styles.summaryRow}>
                  <span>Delivery · Bantama</span>
                  <span>GH₵ {DELIVERY_FEE}</span>
                </span>
                <span className={styles.summaryTotal}>
                  <span>Total</span>
                  <span>GH₵ {subtotal + DELIVERY_FEE}</span>
                </span>
                <span className={styles.momo}>MoMo · 024 551 2093</span>
              </div>
            </div>
          </div>

          <div className={styles.sheetFooter}>
            <span
              className={
                reached('paid') ? styles.flowButtonPaid : at('paying') ? styles.flowButtonPressed : styles.flowButton
              }
            >
              {screen === 0 && `Continue${subtotal ? ` · GH₵ ${subtotal}` : ''}`}
              {screen === 1 && 'Continue'}
              {screen === 2 && (reached('paid') ? '✓ Paid' : `Pay GH₵ ${subtotal + DELIVERY_FEE} with MoMo`)}
            </span>
            <span className={styles.managed}>Managed by the business. Learn more</span>
          </div>
        </div>
      </div>

      <div className={reached('delivering') ? styles.toastShown : styles.toast}>
        <span className={styles.toastIcon}>{reached('delivered') ? '✓' : '₵'}</span>
        <span className={styles.toastText}>
          <strong>{reached('delivered') ? 'Delivered · GH₵ 340' : 'New order · GH₵ 340'}</strong>
          <span>{reached('delivered') ? 'Akua received her order in Bantama' : 'Paid by MoMo · on its way to Bantama'}</span>
        </span>
      </div>
    </div>
  )
}

/** A delivery car driving from the shop's stall to the buyer's home along a little road. */
function DeliveryTracker({ delivered, still }: { delivered: boolean; still: boolean }) {
  const state = delivered || still ? styles.trackerArrived : styles.trackerDriving
  return (
    <div className={`${styles.tracker} ${state}`}>
      <div className={styles.trackerHeader}>
        <strong>{delivered ? 'Delivered to Bantama' : 'On the way to Bantama'}</strong>
        <span>{delivered ? 'Just now' : 'ETA 15 min'}</span>
      </div>
      <div className={styles.road}>
        <span className={styles.pinShop} title="Ama Serwaa Foods">
          <StallIcon />
        </span>
        <span className={styles.lane}>
          <span className={styles.route}>
            <span className={styles.routeFill} />
          </span>
          <span className={styles.car}>
            <span className={styles.dust}>
              <i />
              <i />
              <i />
            </span>
            <CarIcon />
          </span>
        </span>
        <span className={styles.pinHome} title="Akua, Bantama">
          <HomeIcon />
          {delivered && <span className={styles.deliveredBadge}>✓</span>}
        </span>
      </div>
    </div>
  )
}

function CarIcon() {
  return (
    <svg className={styles.carSvg} width="46" height="26" viewBox="0 0 46 26">
      <g className={styles.carBody}>
        {/* Boxes on the roof rack */}
        <rect x="14" y="0" width="9" height="6" rx="1" fill="#f2b33d" />
        <rect x="24" y="1" width="7" height="5" rx="1" fill="#d9442b" />
        {/* Body and cabin */}
        <path d="M4 12 L11 7 H30 L37 12 H42 a2 2 0 0 1 2 2 V19 H2 V14 a2 2 0 0 1 2 -2 Z" fill="#1e7a45" />
        <path d="M13 8.5 H21 V12 H8.5 Z M23 8.5 H29.5 L34 12 H23 Z" fill="#cfeedd" />
        <rect x="2" y="15" width="42" height="2" fill="#155c33" />
        <text x="17" y="18.6" fontSize="4.2" fontWeight="700" fill="#fff" fontFamily="Inter, sans-serif">MX</text>
        <rect x="41" y="13" width="3" height="2" rx="1" fill="#f2b33d" />
      </g>
      <g className={styles.wheel} style={{ transformOrigin: '11px 20px' }}>
        <circle cx="11" cy="20" r="4.5" fill="#1a1d1f" />
        <circle cx="11" cy="20" r="1.6" fill="#d5d9d4" />
        <path d="M11 16v8M7 20h8" stroke="#5b6166" strokeWidth="0.8" />
      </g>
      <g className={styles.wheel} style={{ transformOrigin: '34px 20px' }}>
        <circle cx="34" cy="20" r="4.5" fill="#1a1d1f" />
        <circle cx="34" cy="20" r="1.6" fill="#d5d9d4" />
        <path d="M34 16v8M30 20h8" stroke="#5b6166" strokeWidth="0.8" />
      </g>
    </svg>
  )
}

function StallIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M3 9h18l-2-5H5zM5 9v11h14V9M9 20v-6h6v6" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5" />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h2l2.4 11h10.2L20 8H6.2M10 20h.01M17 20h.01" />
    </svg>
  )
}

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.(query)
    if (!media) return
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return reduced
}
