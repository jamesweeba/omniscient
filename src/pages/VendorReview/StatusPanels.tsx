import { useCallback } from 'react'
import { Link } from 'react-router'
import { useAction } from '@/hooks/useAction'
import { useAsync } from '@/hooks/useAsync'
import { formatCedis, formatDateTime, formatShortDate, formatTimeAgo, whatsAppLink } from '@/lib/format'
import { fetchShopOrders } from '@/lib/orders'
import { formatPhone } from '@/lib/phone'
import { REVIEW_DECISION } from '@/lib/reviewDisplay'
import {
  reinstateVendor,
  releaseVendorNumber,
  suspendVendor,
  type ReviewDecision,
  type ReviewRecord,
  type VendorDetail,
} from '@/lib/vendors'
import { ActionForm } from './ActionForm'
import { refreshOnConflict, type OnChanged } from './refreshOnConflict'
import styles from './VendorReview.module.css'

interface PanelProps {
  vendor: VendorDetail
  /** Called after an action, with a confirmation message; the page reloads the shop. */
  onChanged: OnChanged
}

const latest = (vendor: VendorDetail, decisions: ReviewDecision[]) => vendor.reviews.find((r) => decisions.includes(r.decision))

/** A live shop: its number, recent orders, and suspend. */
export function ActivePanel({ vendor, onChanged }: PanelProps) {
  return (
    <aside className={styles.sideColumn} aria-label="Shop">
      <NumberCard vendor={vendor} />
      <OrdersCard vendor={vendor} />

      <section className={styles.dangerCard} aria-labelledby="danger">
        <div className={styles.cardIntro}>
          <h2 id="danger" className={styles.dangerTitle}>
            Danger zone
          </h2>
          <p className={styles.mutedText}>
            Suspending makes the shop read-only for the vendor, and buyers are told it is temporarily closed. It keeps
            its WhatsApp number.
          </p>
        </div>
        <ActionForm
          label="Reason (shown to the vendor)"
          placeholder="e.g. Buyers reported short-measured orders. Pausing until we’ve spoken to the owner."
          required
          submitLabel="Suspend shop"
          pendingLabel="Suspending…"
          variant="danger"
          confirmMessage={`Suspend ${vendor.shopName}? Buyers will be told the shop is closed.`}
          onSubmit={(reason) =>
            refreshOnConflict(async () => {
              await suspendVendor(vendor.id, reason)
              onChanged(`${vendor.shopName} is suspended. It keeps ${vendor.number ? formatPhone(vendor.number.phone) : 'its number'}.`)
            }, onChanged)
          }
        />
      </section>
    </aside>
  )
}

/** A suspended shop: why, its number, reinstate and release. */
export function SuspendedPanel({ vendor, onChanged }: PanelProps) {
  const suspension = latest(vendor, ['SUSPENDED'])
  const number = vendor.number

  return (
    <aside className={styles.sideColumn} aria-label="Suspension">
      <section className={styles.card} aria-labelledby="suspended">
        <h2 id="suspended" className={styles.cardTitle}>
          Suspended
        </h2>
        {suspension && <ReviewNote review={suspension} tone="danger" />}
        <p className={styles.mutedText}>
          {number ? (
            <>
              It keeps <strong>{formatPhone(number.phone)}</strong> while suspended.
            </>
          ) : (
            'Its number has been released. Reinstating sends it back to the review queue for a new one.'
          )}
        </p>
      </section>

      <section className={styles.dangerCard} aria-labelledby="danger">
        <h2 id="danger" className={styles.dangerTitle}>
          Danger zone
        </h2>
        <div className={styles.dangerActions}>
          <ConfirmButton
            label="Reinstate shop"
            pendingLabel="Reinstating…"
            variant="primary"
            confirmMessage={
              number
                ? `Reinstate ${vendor.shopName}? It reopens on ${formatPhone(number.phone)} straight away.`
                : `Reinstate ${vendor.shopName}? Without a number it goes back to the review queue (or to “not submitted” if nothing is in stock).`
            }
            onConfirm={() =>
              refreshOnConflict(async () => {
                await reinstateVendor(vendor.id)
                onChanged(number ? `${vendor.shopName} is live again.` : `${vendor.shopName} is back in the review queue for a new number.`)
              }, onChanged)
            }
          />
          {number && (
            <ConfirmButton
              label={`Release ${formatPhone(number.phone)}`}
              pendingLabel="Releasing…"
              variant="danger"
              confirmMessage={`Release ${formatPhone(number.phone)} from ${vendor.shopName}? The number cools for 7 days, then goes to another shop. If reinstated, this shop will need a new number.`}
              onConfirm={() =>
                refreshOnConflict(async () => {
                  await releaseVendorNumber(vendor.id)
                  onChanged(`${formatPhone(number.phone)} released. It is cooling for 7 days.`)
                }, onChanged)
              }
            />
          )}
        </div>
      </section>
    </aside>
  )
}

/** More info requested or rejected: the vendor has to resubmit. */
export function WaitingOnVendorPanel({ vendor, onChanged }: PanelProps) {
  const review = latest(vendor, ['MORE_INFO', 'REJECTED'])
  return (
    <aside className={styles.sideColumn} aria-label="Waiting on the vendor">
      <section className={styles.card} aria-labelledby="waiting">
        <h2 id="waiting" className={styles.cardTitle}>
          Waiting on the vendor
        </h2>
        {review && <ReviewNote review={review} tone={review.decision === 'REJECTED' ? 'danger' : 'neutral'} />}
        <p className={styles.mutedText}>
          The vendor sees these notes in their app. When they resubmit, the shop comes back to the review queue.
        </p>
      </section>
      <SuspendCard vendor={vendor} onChanged={onChanged} />
    </aside>
  )
}

/** Signed up but no product in stock yet. */
export function NotSubmittedPanel({ vendor, onChanged }: PanelProps) {
  const done = vendor.kyc.filter((item) => item.done).length
  return (
    <aside className={styles.sideColumn} aria-label="Not submitted">
      <section className={styles.card} aria-labelledby="not-submitted">
        <h2 id="not-submitted" className={styles.cardTitle}>
          Not submitted yet
        </h2>
        <p className={styles.mutedText}>
          The shop joins the review queue when the vendor puts their first product in stock.
        </p>
        <ul className={styles.timeline}>
          {vendor.kyc.map((item) => (
            <li key={item.key} className={styles.timelineItem}>
              <span className={item.done ? styles.dotSuccess : styles.dotNeutral} aria-hidden="true" />
              <span className={styles.timelineText}>{item.label}</span>
            </li>
          ))}
        </ul>
        <p className={done === vendor.kyc.length ? styles.progressDone : styles.progressPending}>
          {done} of {vendor.kyc.length} details complete
        </p>
      </section>
      <SuspendCard vendor={vendor} onChanged={onChanged} />
    </aside>
  )
}

function SuspendCard({ vendor, onChanged }: PanelProps) {
  return (
    <section className={styles.dangerCard} aria-labelledby="danger">
      <h2 id="danger" className={styles.dangerTitle}>
        Danger zone
      </h2>
      <ActionForm
        label="Reason (shown to the vendor)"
        placeholder="e.g. Documents appear to belong to someone else."
        required
        submitLabel="Suspend shop"
        pendingLabel="Suspending…"
        variant="danger"
        confirmMessage={`Suspend ${vendor.shopName}? The vendor can no longer change anything.`}
        onSubmit={(reason) =>
          refreshOnConflict(async () => {
            await suspendVendor(vendor.id, reason)
            onChanged(`${vendor.shopName} is suspended.`)
          }, onChanged)
        }
      />
    </section>
  )
}

function NumberCard({ vendor }: { vendor: VendorDetail }) {
  const number = vendor.number
  if (!number) {
    return (
      <section className={styles.card} aria-labelledby="assigned-number">
        <h2 id="assigned-number" className={styles.cardTitle}>
          WhatsApp number
        </h2>
        <p className={styles.errorText}>No number assigned.</p>
      </section>
    )
  }
  return (
    <section className={styles.card} aria-labelledby="assigned-number">
      <h2 id="assigned-number" className={styles.cardTitle}>
        WhatsApp number
      </h2>
      <span className={styles.statValue}>{formatPhone(number.phone)}</span>
      <p className={styles.mutedText}>
        {[number.displayName && `Shown as “${number.displayName}”`, number.assignedAt && `assigned ${formatShortDate(number.assignedAt)}`]
          .filter(Boolean)
          .join(', ')}
      </p>
      <div className={styles.linkRow}>
        <a className={styles.textLink} href={whatsAppLink(number.phone)} target="_blank" rel="noreferrer">
          Open wa.me link
        </a>
        <Link className={styles.textLink} to="/whatsapp-numbers">
          Number pool
        </Link>
      </div>
    </section>
  )
}

function OrdersCard({ vendor }: { vendor: VendorDetail }) {
  const load = useCallback(
    () => fetchShopOrders(vendor.id, { tab: 'placed', period: '30d', page: 1, pageSize: 1 }),
    [vendor.id],
  )
  const orders = useAsync(load)
  const summary = orders.status === 'success' ? orders.data.summary : null
  const lastOrder = orders.status === 'success' ? orders.data.items[0] : undefined

  return (
    <section className={styles.card} aria-labelledby="orders">
      <h2 id="orders" className={styles.cardTitle}>
        Orders · last 30 days
      </h2>
      {orders.status === 'loading' && <p className={styles.mutedText}>Loading…</p>}
      {orders.status === 'error' && <p className={styles.errorText}>{orders.error}</p>}
      {summary && (
        <dl className={styles.stats}>
          <div className={styles.field}>
            <dt>Orders</dt>
            <dd className={styles.statValue}>{summary.orders}</dd>
          </div>
          <div className={styles.field}>
            <dt>Open</dt>
            <dd className={styles.statValue}>{summary.open}</dd>
          </div>
          <div className={styles.field}>
            <dt>Delivered sales</dt>
            <dd>{formatCedis(summary.deliveredSales)}</dd>
          </div>
          <div className={styles.field}>
            <dt>Last order</dt>
            <dd>{lastOrder ? formatTimeAgo(lastOrder.createdAt) : 'None'}</dd>
          </div>
        </dl>
      )}
      <Link className={styles.textLink} to={`/orders/${vendor.id}`}>
        View all orders
      </Link>
    </section>
  )
}

function ReviewNote({ review, tone }: { review: ReviewRecord; tone: 'danger' | 'neutral' }) {
  return (
    <div className={tone === 'danger' ? styles.statusNoteDanger : styles.statusNote}>
      <span>{review.notes || REVIEW_DECISION[review.decision].label}</span>
      <span className={styles.optionHint}>
        {review.reviewer ? `${review.reviewer.firstName} ${review.reviewer.lastName} · ` : ''}
        {formatDateTime(review.createdAt)}
      </span>
    </div>
  )
}

interface ConfirmButtonProps {
  label: string
  pendingLabel: string
  variant: 'primary' | 'danger'
  confirmMessage: string
  onConfirm: () => Promise<void>
}

/** One button that asks first, then shows the server's error if the action fails. */
function ConfirmButton({ label, pendingLabel, variant, confirmMessage, onConfirm }: ConfirmButtonProps) {
  const { pending, error, run } = useAction()

  function handleClick() {
    // On success the shop reloads and this panel is replaced.
    if (window.confirm(confirmMessage)) void run(onConfirm, { keepPendingOnSuccess: true })
  }

  return (
    <>
      <button className={variant === 'primary' ? styles.primaryButton : styles.dangerButton} type="button" disabled={pending} onClick={handleClick}>
        {pending ? pendingLabel : label}
      </button>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  )
}
