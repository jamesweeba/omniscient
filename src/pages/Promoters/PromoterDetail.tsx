import { useCallback, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { BackLink } from '@/components/BackLink/BackLink'
import { Badge } from '@/components/Badge/Badge'
import { Dialog } from '@/components/Dialog/Dialog'
import { useAction } from '@/hooks/useAction'
import { useAsync } from '@/hooks/useAsync'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cedis, formatDate, formatDateTime } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import {
  fetchPromoter,
  PROMOTER_LEDGER_ENTRY,
  PROMOTER_STATUS,
  referralLabel,
  reinstatePromoter,
  suspendPromoter,
  type PromoterDetail as Detail,
} from '@/lib/promotersAdmin'
import table from '@/styles/table.module.css'
import styles from '../VendorReview/VendorReview.module.css'
import { PromoterPayoutsTable } from './PromoterPayoutsTable'

const MEMBERSHIP: Record<Detail['shops'][number]['status'], { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' }> = {
  APPROVED: { label: 'Approved', tone: 'success' },
  REQUESTED: { label: 'Asked to join', tone: 'warning' },
  INVITED: { label: 'Invited', tone: 'neutral' },
  DECLINED: { label: 'Declined', tone: 'neutral' },
  REMOVED: { label: 'Removed', tone: 'danger' },
}

/** Route entry: remounts when the promoter in the URL changes. */
export function PromoterDetail() {
  const { promoterId = '' } = useParams()
  return <PromoterPage key={promoterId} promoterId={promoterId} />
}

function PromoterPage({ promoterId }: { promoterId: string }) {
  const load = useCallback(() => fetchPromoter(promoterId), [promoterId])
  const result = useAsync(load, { live: true })
  usePageTitle(result.status === 'success' ? (result.data.fullName ?? 'Promoter') : 'Promoter')

  return (
    <>
      <BackLink to="/promoters" small>
        Back to promoters
      </BackLink>
      {result.status === 'loading' && <p className={styles.message}>Loading promoter…</p>}
      {result.status === 'error' && <p className={styles.message}>{result.error}</p>}
      {result.status === 'success' && <Content promoter={result.data} />}
    </>
  )
}

function Content({ promoter: p }: { promoter: Detail }) {
  const [suspending, setSuspending] = useState(false)
  // When the page opened: whether a commission is still held is shown as of then.
  const [now] = useState(() => Date.now())
  const { pending, error, run } = useAction()
  const status = PROMOTER_STATUS[p.status]
  const ownNumber = p.referrals.filter((r) => r.reason === 'OWN_NUMBER').length

  return (
    <>
      <header className={styles.header}>
        <div className={styles.cardIntro}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{p.fullName ?? 'Unnamed promoter'}</h1>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className={styles.meta}>
            {formatPhone(p.phone, 'local')} · joined {formatDate(p.createdAt)}
            {p.termsAcceptedAt ? ` · accepted the terms ${formatDate(p.termsAcceptedAt)}` : ' · hasn’t finished signing up'}
          </p>
        </div>
        <div className={styles.headerActions}>
          {p.status === 'SUSPENDED' ? (
            <button className={styles.secondaryButton} type="button" disabled={pending} onClick={() => run(() => reinstatePromoter(p.id))}>
              {pending ? 'Reinstating…' : 'Reinstate'}
            </button>
          ) : (
            <button className={styles.dangerButton} type="button" onClick={() => setSuspending(true)}>
              Suspend
            </button>
          )}
        </div>
      </header>

      {error && <p className={styles.errorText}>{error}</p>}
      {p.status === 'SUSPENDED' && (
        <p className={styles.statusNoteDanger}>
          <strong>Suspended:</strong> {p.suspendedReason ?? 'no reason recorded'}. Their links don’t count, new orders aren’t credited to them, and
          they can’t withdraw.
        </p>
      )}
      {ownNumber > 0 && (
        <p className={styles.statusNote}>
          ⚠️ {ownNumber} of their recent orders were placed or paid with the promoter’s own number. Those earned nothing; check whether they’re
          gaming the programme.
        </p>
      )}

      <div className={styles.columns}>
        <div className={styles.mainColumn}>
          <section className={styles.card} aria-labelledby="money">
            <h2 id="money" className={styles.cardTitle}>
              Money
            </h2>
            <dl className={styles.moneyFacts}>
              <div>
                <dt>Ready to withdraw</dt>
                <dd>{cedis(Math.max(p.money.available, 0))}</dd>
              </div>
              <div>
                <dt>Held (7 days after delivery)</dt>
                <dd>{cedis(p.money.onHold)}</dd>
              </div>
              <div>
                <dt>Earned in total</dt>
                <dd>{cedis(p.money.earned)}</dd>
              </div>
            </dl>
            {p.money.nextReleaseAt && <p className={styles.meta}>Next held commission is ready {formatDateTime(p.money.nextReleaseAt)}.</p>}
            <p className={styles.meta}>
              MoMo:{' '}
              {p.momo.number ? (
                <>
                  {formatPhone(p.momo.number, 'local')}
                  {p.momo.network && ` (${p.momo.network})`}
                  {p.momo.name && ` · ${p.momo.name}`} · {p.momo.verified ? 'name checked with Paystack' : 'name not checked'}
                </>
              ) : (
                'not set'
              )}
            </p>
          </section>

          <section className={styles.card} aria-labelledby="shops">
            <h2 id="shops" className={styles.cardTitle}>
              Shops
            </h2>
            {p.shops.length === 0 ? (
              <p className={styles.meta}>Not connected to any shop yet.</p>
            ) : (
              <ul className={table.stack} style={{ listStyle: 'none', margin: 0, padding: 0, gap: 12 }}>
                {p.shops.map((s) => (
                  <li key={s.id}>
                    <div className={table.stack}>
                      <span>
                        <Link className={table.primary} to={`/vendors/${s.tenant.id}`}>
                          {s.tenant.name}
                        </Link>{' '}
                        <Badge tone={MEMBERSHIP[s.status].tone}>{MEMBERSHIP[s.status].label}</Badge>
                      </span>
                      <span className={table.secondary}>
                        {s.links.filter((l) => l.active).map((l) => `${l.productName ?? 'Whole shop'} (${l.code})`).join(', ') || 'No active links'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className={styles.sideColumn}>
          <section className={styles.card} aria-labelledby="ledger">
            <h2 id="ledger" className={styles.cardTitle}>
              Statement
            </h2>
            {p.ledger.length === 0 ? (
              <p className={styles.meta}>Nothing yet.</p>
            ) : (
              <ul className={table.stack} style={{ listStyle: 'none', margin: 0, padding: 0, gap: 10 }}>
                {p.ledger.map((e) => (
                  <li key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span className={table.stack}>
                      <span>
                        {PROMOTER_LEDGER_ENTRY[e.type]}
                        {e.orderNumber && ` · ${e.orderNumber}`}
                      </span>
                      <span className={table.secondary}>
                        {formatDateTime(e.createdAt)}
                        {e.shopName && ` · ${e.shopName}`}
                        {e.availableAt && new Date(e.availableAt).getTime() > now && ` · held until ${formatDate(e.availableAt)}`}
                      </span>
                    </span>
                    <strong className={e.amount < 0 ? `${table.nowrap} ${table.warning}` : table.nowrap}>{cedis(e.amount)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className={styles.card} aria-labelledby="orders">
        <h2 id="orders" className={styles.cardTitle}>
          Buyers they brought in
        </h2>
        <div className={table.scroll}>
          <table className={table.table}>
            <thead>
              <tr>
                <th>Buyer</th>
                <th>Shop · link</th>
                <th>Order · commission</th>
              </tr>
            </thead>
            <tbody>
              {p.referrals.length === 0 ? (
                <tr>
                  <td className={table.emptyCell} colSpan={3}>
                    No buyers from their links yet.
                  </td>
                </tr>
              ) : (
                p.referrals.map((r) => {
                  const state = referralLabel(r)
                  return (
                    <tr key={r.id}>
                      <td className={table.nowrap}>
                        <div className={table.stack}>
                          <span>{formatPhone(r.buyerPhone, 'local')}</span>
                          <span className={table.secondary}>tapped {formatDateTime(r.tappedAt)}</span>
                        </div>
                      </td>
                      <td>
                        <div className={table.stack}>
                          <Link className={table.primary} to={`/vendors/${r.tenant.id}`}>
                            {r.tenant.name}
                          </Link>
                          <span className={table.secondary}>
                            {r.productName ?? 'Whole shop'} · {r.linkCode} · {r.ratePercent}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={table.stack}>
                          {r.order && (
                            <span className={table.nowrap}>
                              <Link to={`/orders/${r.tenant.id}?q=${encodeURIComponent(r.order.orderNumber)}`}>{r.order.orderNumber}</Link> ·{' '}
                              {cedis(r.commissionAmount ?? 0)}
                            </span>
                          )}
                          <span>
                            <Badge tone={state.tone}>{state.label}</Badge>
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <p className={styles.meta}>The 20 most recent.</p>
      </section>

      <section className={styles.card} aria-labelledby="payouts">
        <h2 id="payouts" className={styles.cardTitle}>
          Payouts
        </h2>
        <PromoterPayoutsTable payouts={p.payouts} emptyMessage="Nothing sent to their MoMo yet." showPromoter={false} />
      </section>

      {suspending && <SuspendDialog promoter={p} onClose={() => setSuspending(false)} />}
    </>
  )
}

function SuspendDialog({ promoter, onClose }: { promoter: Detail; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const { pending, error, run } = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim()) return
    if (await run(() => suspendPromoter(promoter.id, reason.trim()), { keepPendingOnSuccess: true })) onClose()
  }

  return (
    <Dialog
      title={`Suspend ${promoter.fullName ?? 'this promoter'}?`}
      description="Their links stop counting, new orders aren’t credited to them, and they can’t withdraw. Money they’ve earned stays in their balance. They’re told on WhatsApp, without your reason."
      onClose={() => !pending && onClose()}
    >
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label className={styles.formField}>
          <span className={styles.formLabel}>Reason (for admins)</span>
          <textarea
            className={styles.textarea}
            rows={3}
            maxLength={500}
            value={reason}
            disabled={pending}
            autoFocus
            placeholder="e.g. Ordered through their own link with a second number"
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && <p className={styles.errorText}>{error}</p>}
        <div className={styles.headerActions}>
          <button className={styles.dangerButton} type="submit" disabled={pending || !reason.trim()}>
            {pending ? 'Suspending…' : 'Suspend'}
          </button>
          <button className={styles.secondaryButton} type="button" disabled={pending} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  )
}
