import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAsync } from '@/hooks/useAsync'
import { formatDateTime } from '@/lib/format'
import { cedis, fetchMyMoney, fetchMyStatement, formatPayoutDay, LEDGER_ENTRY, PAYOUT_STATUS, type LedgerEntry, type ShopMoney } from '@/lib/payouts'
import { formatPhone } from '@/lib/phone'
import styles from '../vendor.module.css'
import money from './Money.module.css'
import { VendorPageHeader } from './VendorPageHeader'

const PAGE_SIZE = 10

/** What MarketiX owes the vendor, what's been sent to their MoMo, and every entry behind it. */
export function Money() {
  const summary = useAsync(fetchMyMoney)

  return (
    <>
      <VendorPageHeader title="Money" lead="What you've earned, what we've sent to your MoMo, and what's on the way." />
      {summary.status === 'loading' && <p className={styles.centered}>Loading…</p>}
      {summary.status === 'error' && <p className={styles.alertError}>{summary.error}</p>}
      {summary.status === 'success' && <MoneyContent summary={summary.data} />}
    </>
  )
}

function MoneyContent({ summary }: { summary: ShopMoney }) {
  const { balance, inFlight, totals, awaitingConfirmation, lastPayout } = summary
  const owes = balance < 0

  return (
    <>
      <section className={`${styles.card} ${money.balanceCard}`} aria-label="Balance">
        <span className={money.balanceLabel}>{owes ? 'You owe MarketiX' : 'Owed to you'}</span>
        <span className={owes ? money.balanceOwed : money.balance}>{cedis(Math.abs(balance))}</span>
        <p className={styles.muted}>
          {owes
            ? `This is our ${summary.commissionPercent}% on your cash orders. It comes off your next MoMo payout.`
            : balance > 0
              ? payoutNote(summary)
              : `Each order is added here once the buyer confirms they got it.`}
        </p>
        {inFlight > 0 && (
          <p className={styles.alertInfo}>
            {cedis(inFlight)} is on its way to your MoMo ({summary.momo.number ? formatPhone(summary.momo.number, 'local') : 'your number'}).
          </p>
        )}
        {lastPayout?.status === 'FAILED' && (
          <p className={styles.alertWarning}>
            Your last payout didn’t go through. We’re looking into it; the money is safe in your balance.
          </p>
        )}
      </section>

      <PayoutSchedule summary={summary} />

      {awaitingConfirmation.count > 0 && (
        <section className={styles.card} aria-labelledby="waiting">
          <h2 id="waiting" className={styles.cardTitle}>
            Waiting for buyers to confirm · {cedis(awaitingConfirmation.amount)}
          </h2>
          <p className={styles.muted}>
            These orders are delivered. You’re paid for each one as soon as the buyer taps “I got my order” on WhatsApp.
          </p>
          <ul className={money.waitingList}>
            {awaitingConfirmation.orders.slice(0, 10).map((o) => (
              <li key={o.id}>
                <Link to={`/vendor/orders/${o.id}`}>{o.orderNumber}</Link>
                <span>{cedis(o.vendorShare)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.card} aria-labelledby="totals">
        <h2 id="totals" className={styles.cardTitle}>
          So far
        </h2>
        <dl className={money.totals}>
          <dt>Earned from MoMo and card orders</dt>
          <dd>{cedis(totals.earned)}</dd>
          <dt>Sent to your MoMo</dt>
          <dd>{cedis(totals.paidOut)}</dd>
          <dt>MarketiX {summary.commissionPercent}% on MoMo and card orders</dt>
          <dd>{cedis(totals.commissionOnPaidOrders)}</dd>
          <dt>MarketiX {summary.commissionPercent}% on cash orders</dt>
          <dd>{cedis(totals.commissionOnCashOrders)}</dd>
        </dl>
        <p className={styles.fieldHint}>
          We keep {summary.commissionPercent}% of what your items sell for. Delivery fees are all yours, and we pay the Paystack fees.
        </p>
      </section>

      <Statement />
    </>
  )
}

function payoutNote(summary: ShopMoney): string {
  if (summary.payouts.paused) return 'Payouts to your shop are on hold. MarketiX will contact you.'
  if (!summary.payouts.enabled) return 'MoMo payouts start soon. Your balance is safe and will be sent in full.'
  if (summary.balance < summary.minPayout) return `We send it once it reaches ${cedis(summary.minPayout)}.`
  return `Sent to ${summary.momo.number ? formatPhone(summary.momo.number, 'local') : 'your MoMo'} at the next payout: ${formatPayoutDay(summary.payouts.nextPayoutAt)}.`
}

/** When vendors are paid, and when the next payout is. */
function PayoutSchedule({ summary }: { summary: ShopMoney }) {
  const { payouts, momo } = summary
  return (
    <section className={`${styles.card} ${money.schedule}`} aria-labelledby="schedule">
      <span className={money.scheduleIcon} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
      <div className={money.scheduleText}>
        <h2 id="schedule" className={money.scheduleTitle}>
          {payouts.paused ? 'Payouts on hold' : payouts.enabled ? `Next payout: ${formatPayoutDay(payouts.nextPayoutAt)}` : 'MoMo payouts start soon'}
        </h2>
        <p className={styles.muted}>
          {payouts.schedule} (no payouts on Sunday). We send everything you’re owed to your MoMo
          {momo.number ? ` (${formatPhone(momo.number, 'local')})` : ''}, for orders buyers have confirmed. Orders confirmed on
          Saturday after 7 am or on Sunday are paid on Monday morning.
        </p>
      </div>
    </section>
  )
}

function Statement() {
  const [page, setPage] = useState(1)
  const load = useCallback(() => fetchMyStatement(page, PAGE_SIZE), [page])
  const result = useAsync(load)
  const data = result.status === 'success' ? result.data : null

  return (
    <section className={styles.card} aria-labelledby="statement">
      <h2 id="statement" className={styles.cardTitle}>
        Statement
      </h2>
      {result.status === 'loading' && <p className={styles.muted}>Loading…</p>}
      {result.status === 'error' && <p className={styles.alertError}>{result.error}</p>}
      {data && data.data.length === 0 && <p className={styles.muted}>Nothing yet. Your first entry appears when a buyer confirms an order.</p>}
      {data && data.data.length > 0 && (
        <>
          <ul className={money.entries} aria-busy={result.isFetching}>
            {data.data.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.meta.total} onPageChange={setPage} />
        </>
      )}
    </section>
  )
}

function EntryRow({ entry }: { entry: LedgerEntry }) {
  const d = entry.details
  const detail =
    entry.type === 'ORDER_EARNING' && d
      ? `Items ${cedis(d.items)} − ${cedis(d.commission)} commission + ${cedis(d.deliveryFee)} delivery`
      : entry.type === 'CASH_COMMISSION' && d
        ? `${cedis(d.commission)} on ${cedis(d.items)} of items paid in cash`
        : entry.type === 'PAYOUT_REVERSAL' && entry.payout?.failureReason
          ? entry.payout.failureReason
          : null

  return (
    <li className={money.entry}>
      <div className={money.entryMain}>
        <span className={money.entryTitle}>
          {LEDGER_ENTRY[entry.type]}
          {entry.orderNumber && ` · ${entry.orderNumber}`}
        </span>
        <span className={money.entryMeta}>
          {formatDateTime(entry.createdAt)}
          {entry.type === 'PAYOUT' && entry.payout && (
            <>
              {' · '}
              <Badge tone={PAYOUT_STATUS[entry.payout.status].tone}>{PAYOUT_STATUS[entry.payout.status].label}</Badge>
            </>
          )}
        </span>
        {detail && <span className={money.entryMeta}>{detail}</span>}
      </div>
      <span className={entry.amount < 0 ? money.amountOut : money.amountIn}>
        {entry.amount > 0 ? '+' : ''}
        {cedis(entry.amount)}
      </span>
    </li>
  )
}
