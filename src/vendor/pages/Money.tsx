import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import { Dialog } from '@/components/Dialog/Dialog'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAsync } from '@/hooks/useAsync'
import { onDataChanged } from '@/lib/dataEvents'
import { formatDateTime } from '@/lib/format'
import {
  cedis,
  fetchMyMoney,
  fetchMyStatement,
  LEDGER_ENTRY,
  parseCedis,
  PAYOUT_STATUS,
  requestWithdrawal,
  withdrawState,
  type LedgerEntry,
  type ShopMoney,
} from '@/lib/payouts'
import { formatPhone } from '@/lib/phone'
import styles from '../vendor.module.css'
import money from './Money.module.css'
import { VendorPageHeader } from './VendorPageHeader'

const PAGE_SIZE = 10

/** What MarketiX owes the vendor, withdrawing it to their MoMo, and every entry behind it. */
export function Money() {
  const summary = useAsync(fetchMyMoney)
  const { reload } = summary
  useEffect(() => onDataChanged(reload), [reload])

  return (
    <>
      <VendorPageHeader title="Money" lead="What you've earned, withdrawing it to your MoMo, and what's on the way." />
      {summary.status === 'loading' && <p className={styles.centered}>Loading…</p>}
      {summary.status === 'error' && <p className={styles.alertError}>{summary.error}</p>}
      {summary.status === 'success' && <MoneyContent summary={summary.data} />}
    </>
  )
}

function MoneyContent({ summary }: { summary: ShopMoney }) {
  const { balance, inFlight, totals, awaitingConfirmation, lastPayout } = summary
  const owes = balance < 0
  const withdraw = withdrawState(summary)
  const [withdrawing, setWithdrawing] = useState(false)
  const [sent, setSent] = useState<string | null>(null)

  return (
    <>
      <section className={`${styles.card} ${money.balanceCard}`} aria-label="Balance">
        <span className={money.balanceLabel}>{owes ? 'You owe MarketiX' : 'Owed to you'}</span>
        <span className={owes ? money.balanceOwed : money.balance}>{cedis(Math.abs(balance))}</span>
        <p className={styles.muted}>
          {owes
            ? `This is our ${summary.commissionPercent}% on your cash orders. It comes off your balance as buyers confirm new orders.`
            : `Each order is added here once the buyer confirms they got it. Withdraw it to your MoMo whenever you like, once a day.`}
        </p>
        {sent && (
          <p className={styles.alertSuccess} role="status">
            {sent}
          </p>
        )}
        {!owes && (
          <>
            <button className={styles.primary} type="button" disabled={!withdraw.canWithdraw} onClick={() => setWithdrawing(true)}>
              Withdraw to MoMo
            </button>
            {!withdraw.canWithdraw && balance > 0 && <p className={styles.fieldHint}>{withdraw.reason}</p>}
          </>
        )}
        {inFlight > 0 && (
          <p className={styles.alertInfo}>
            {cedis(inFlight)} is on its way to your MoMo ({summary.momo.number ? formatPhone(summary.momo.number, 'local') : 'your number'}).
          </p>
        )}
        {lastPayout?.status === 'FAILED' && (
          <p className={styles.alertWarning}>
            Your last withdrawal didn’t go through{lastPayout.failureReason ? `: ${lastPayout.failureReason}` : ''}. The money is back in your
            balance, and you can withdraw it again.
          </p>
        )}
      </section>

      {withdrawing && (
        <WithdrawDialog
          summary={summary}
          onClose={() => setWithdrawing(false)}
          onSent={(amount) => {
            setWithdrawing(false)
            setSent(`${cedis(amount)} is on its way to your MoMo. It usually lands within a few minutes.`)
          }}
        />
      )}

      <WithdrawRules summary={summary} />

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

/** Ask for part or all of the balance to be sent to the vendor's MoMo. */
function WithdrawDialog({ summary, onClose, onSent }: { summary: ShopMoney; onClose: () => void; onSent: (amount: number) => void }) {
  const { balance, minPayout, momo } = summary
  const [text, setText] = useState((balance / 100).toFixed(2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amount = parseCedis(text)
  const invalid =
    amount === null
      ? 'Enter an amount, like 150 or 150.50.'
      : amount < minPayout
        ? `The least you can withdraw is ${cedis(minPayout)}.`
        : amount > balance
          ? `You can withdraw up to ${cedis(balance)}.`
          : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid || amount === null) return
    setBusy(true)
    setError(null)
    try {
      await requestWithdrawal(amount) // the page reloads through onDataChanged
      onSent(amount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Withdraw to MoMo"
      description={`You can withdraw once a day. Available: ${cedis(balance)}.`}
      onClose={() => !busy && onClose()}
    >
      <form className={money.withdrawForm} onSubmit={submit} noValidate>
        <label className={styles.field}>
          Amount (GH₵)
          <input
            className={text && invalid ? styles.inputInvalid : styles.input}
            inputMode="decimal"
            autoComplete="off"
            value={text}
            disabled={busy}
            autoFocus
            aria-invalid={Boolean(text && invalid)}
            onChange={(e) => setText(e.target.value)}
          />
          {text && invalid ? (
            <span className={styles.fieldError}>{invalid}</span>
          ) : (
            <span className={styles.fieldHint}>
              Sent to {momo.number ? formatPhone(momo.number, 'local') : 'your MoMo'}
              {momo.name ? ` (${momo.name})` : ''}. MarketiX pays the transfer fee.
            </span>
          )}
        </label>
        {amount !== balance && (
          <button className={styles.textButton} type="button" disabled={busy} onClick={() => setText((balance / 100).toFixed(2))}>
            Withdraw all {cedis(balance)}
          </button>
        )}
        {error && (
          <p className={styles.alertError} role="alert">
            {error}
          </p>
        )}
        <button className={styles.primary} type="submit" disabled={busy || invalid !== null}>
          {busy ? 'Sending…' : amount !== null && !invalid ? `Withdraw ${cedis(amount)}` : 'Withdraw'}
        </button>
      </form>
    </Dialog>
  )
}

/** How withdrawals work. */
function WithdrawRules({ summary }: { summary: ShopMoney }) {
  const { payouts, momo, minPayout } = summary
  return (
    <section className={`${styles.card} ${money.schedule}`} aria-labelledby="withdraw-rules">
      <span className={money.scheduleIcon} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
      <div className={money.scheduleText}>
        <h2 id="withdraw-rules" className={money.scheduleTitle}>
          {payouts.paused ? 'Withdrawals on hold' : payouts.enabled ? 'One withdrawal a day' : 'Withdrawals start soon'}
        </h2>
        <p className={styles.muted}>
          Withdraw any amount from {cedis(minPayout)} up to your balance to your MoMo
          {momo.number ? ` (${formatPhone(momo.number, 'local')})` : ''}, once a day. A new day starts at midnight. If a withdrawal
          doesn’t go through, the money comes back to your balance and you can try again the same day. Nothing is sent until you
          withdraw.
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
