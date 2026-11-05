import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import { useAsync } from '@/hooks/useAsync'
import { isConflict } from '@/lib/api'
import { onDataChanged } from '@/lib/dataEvents'
import { formatDateTime } from '@/lib/format'
import { cedis, fetchShopMoney, fetchShopStatement, LEDGER_ENTRY, payVendorNow, PAYOUT_STATUS, setPayoutsPaused, type ShopMoney } from '@/lib/payouts'
import { formatPhone } from '@/lib/phone'
import type { VendorDetail } from '@/lib/vendors'
import styles from './VendorReview.module.css'

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.')

/** What MarketiX owes this shop, its payouts, and the controls to pause or pay now. */
export function MoneyCard({ vendor }: { vendor: VendorDetail }) {
  const load = useCallback(() => fetchShopMoney(vendor.id), [vendor.id])
  const money = useAsync(load)
  const { reload } = money
  useEffect(() => onDataChanged(reload), [reload])

  return (
    <section className={styles.card} aria-labelledby="money">
      <div className={styles.cardHeader}>
        <h2 id="money" className={styles.cardTitle}>
          Money
        </h2>
        <Link className={styles.textLink} to={`/payouts?view=payouts&q=${encodeURIComponent(vendor.shopName)}`}>
          All payouts
        </Link>
      </div>
      {money.status === 'loading' && <p className={styles.mutedText}>Loading…</p>}
      {money.status === 'error' && <p className={styles.errorText}>{money.error}</p>}
      {money.status === 'success' && <MoneyContent vendorId={vendor.id} money={money.data} />}
    </section>
  )
}

function MoneyContent({ vendorId, money }: { vendorId: string; money: ShopMoney }) {
  const [busy, setBusy] = useState<'pay' | 'pause' | null>(null)
  const [pausing, setPausing] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const { balance, totals, awaitingConfirmation, lastPayout, payouts } = money

  async function act(kind: 'pay' | 'pause', action: () => Promise<unknown>, done: string) {
    setBusy(kind)
    setError(null)
    setFlash(null)
    try {
      await action() // the card reloads through onDataChanged
      setFlash(done)
      setPausing(false)
      setReason('')
    } catch (err) {
      setError(isConflict(err) ? err.message : errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <dl className={styles.moneyFacts}>
        <div>
          <dt>{balance < 0 ? 'Owes MarketiX' : 'Owed to vendor'}</dt>
          <dd className={balance < 0 ? styles.moneyOwed : undefined}>{cedis(Math.abs(balance))}</dd>
        </div>
        <div>
          <dt>Waiting for buyers to confirm</dt>
          <dd>
            {cedis(awaitingConfirmation.amount)}
            <span className={styles.mutedText}> · {awaitingConfirmation.count} orders</span>
          </dd>
        </div>
        <div>
          <dt>Paid out</dt>
          <dd>{cedis(totals.paidOut)}</dd>
        </div>
        <div>
          <dt>MarketiX {money.commissionPercent}%</dt>
          <dd>{cedis(totals.commissionOnPaidOrders + totals.commissionOnCashOrders)}</dd>
        </div>
      </dl>

      <p className={styles.mutedText}>
        MoMo for payouts: {money.momo.number ? `${formatPhone(money.momo.number, 'local')}${money.momo.name ? ` (${money.momo.name})` : ''}` : 'not set'}
        {lastPayout && (
          <>
            {' · Last payout '}
            {cedis(lastPayout.amount)}, {formatDateTime(lastPayout.createdAt)}{' '}
            <Badge tone={PAYOUT_STATUS[lastPayout.status].tone}>{PAYOUT_STATUS[lastPayout.status].label}</Badge>
          </>
        )}
      </p>
      {lastPayout?.status === 'FAILED' && lastPayout.failureReason && <p className={styles.errorText}>Last payout failed: {lastPayout.failureReason}</p>}
      {payouts.enabled && !payouts.paused && (
        <p className={styles.mutedText}>
          {payouts.nextWithdrawalAt ? 'The vendor has withdrawn today.' : 'The vendor can withdraw today.'} Nothing is sent until they
          withdraw or you pay now.
        </p>
      )}
      {payouts.paused && <p className={styles.flashWarning}>Withdrawals paused: {payouts.pausedReason}</p>}
      {!payouts.enabled && <p className={styles.mutedText}>Payouts are switched off for everyone (PAYOUTS_ENABLED), so nothing is sent yet.</p>}

      {pausing && (
        <div className={styles.formField}>
          <label className={styles.formLabel} htmlFor="pause-reason">
            Why pause withdrawals? <span className={styles.formLabelHint}>(admins only)</span>
          </label>
          <textarea
            id="pause-reason"
            className={styles.textarea}
            rows={2}
            maxLength={500}
            placeholder="e.g. Buyer says order MX-ABC123 never arrived; checking with the vendor."
            value={reason}
            disabled={busy !== null}
            autoFocus
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      )}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
      {flash && (
        <p className={styles.flash} role="status">
          {flash}
        </p>
      )}

      <div className={styles.bannerActions}>
        {!pausing && (
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={busy !== null || payouts.paused || !payouts.enabled || balance <= 0}
            onClick={() => act('pay', () => payVendorNow(vendorId), 'Payout sent to Paystack.')}
          >
            {busy === 'pay' ? 'Sending…' : `Pay ${cedis(Math.max(balance, 0))} now`}
          </button>
        )}
        {payouts.paused ? (
          <button className={styles.secondaryButton} type="button" disabled={busy !== null} onClick={() => act('pause', () => setPayoutsPaused(vendorId, false), 'Withdrawals resumed.')}>
            {busy === 'pause' ? 'Saving…' : 'Resume withdrawals'}
          </button>
        ) : pausing ? (
          <>
            <button
              className={styles.dangerButton}
              type="button"
              disabled={busy !== null || !reason.trim()}
              onClick={() => act('pause', () => setPayoutsPaused(vendorId, true, reason.trim()), 'Withdrawals paused. Money keeps adding up until you resume.')}
            >
              {busy === 'pause' ? 'Saving…' : 'Pause withdrawals'}
            </button>
            <button className={styles.secondaryButton} type="button" disabled={busy !== null} onClick={() => setPausing(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className={styles.dangerButton} type="button" disabled={busy !== null} onClick={() => setPausing(true)}>
            Pause withdrawals
          </button>
        )}
      </div>

      <RecentEntries vendorId={vendorId} />
    </>
  )
}

function RecentEntries({ vendorId }: { vendorId: string }) {
  const load = useCallback(() => fetchShopStatement(vendorId, 1, 5), [vendorId])
  const result = useAsync(load)
  const { reload } = result
  useEffect(() => onDataChanged(reload), [reload])
  if (result.status !== 'success' || result.data.data.length === 0) return null

  return (
    <details className={styles.moneyEntries}>
      <summary>Latest entries</summary>
      <ul>
        {result.data.data.map((e) => (
          <li key={e.id}>
            <span>
              {LEDGER_ENTRY[e.type]}
              {e.orderNumber && ` · ${e.orderNumber}`}
              <span className={styles.mutedText}> · {formatDateTime(e.createdAt)}</span>
            </span>
            <strong>
              {e.amount > 0 ? '+' : ''}
              {cedis(e.amount)}
            </strong>
          </li>
        ))}
      </ul>
    </details>
  )
}
