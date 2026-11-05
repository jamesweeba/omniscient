import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { StatCard, StatGrid } from '@/components/StatCard/StatCard'
import { useAsync } from '@/hooks/useAsync'
import { fetchDailySummary, formatSummaryDay, type DailySummary as Summary } from '@/lib/dailySummary'
import { cedis, plural } from '@/lib/format'
import {  } from '@/lib/payouts'
import styles from './DailySummary.module.css'


/** Yesterday (or any earlier day) at a glance: sales, commission, payouts, new shops, and what needs an admin now. */
export function DailySummary() {
  const [date, setDate] = useState<string | undefined>(undefined) // undefined: yesterday
  const load = useCallback(() => fetchDailySummary(date), [date])
  const result = useAsync(load)
  const data = result.status === 'success' ? result.data : null

  return (
    <section className={styles.panel} aria-labelledby="daily-summary" aria-busy={result.isFetching}>
      <div className={styles.header}>
        <h2 id="daily-summary" className={styles.title}>
          {data ? formatSummaryDay(data.date) : 'Yesterday'} at a glance
        </h2>
        {data && (
          <div className={styles.nav}>
            <button className={styles.navButton} type="button" disabled={result.isFetching} onClick={() => setDate(data.previousDate)} aria-label="Previous day">
              ‹
            </button>
            <button
              className={styles.navButton}
              type="button"
              disabled={result.isFetching || !data.nextDate}
              onClick={() => data.nextDate && setDate(data.nextDate)}
              aria-label="Next day"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {result.status === 'loading' && <p className={styles.muted}>Loading…</p>}
      {result.status === 'error' && <p className={styles.error}>{result.error}</p>}
      {data && <Content data={data} />}
    </section>
  )
}

function Content({ data }: { data: Summary }) {
  const { orders, needsAttention, money } = data
  const attention = [
    money.shortfall !== null && money.shortfall > 0 && { to: '/payouts', text: `Top up Paystack: ${cedis(money.shortfall)} short of what vendors are owed` },
    needsAttention.stuckPayouts > 0 && {
      to: '/payouts?view=payouts&status=processing',
      text: `${plural(needsAttention.stuckPayouts, 'payout')} stuck on the way (${cedis(money.stuckPayouts.amount)}): check them in Paystack`,
    },
    needsAttention.failedPayouts > 0 && { to: '/payouts?view=payouts&status=failed', text: `${plural(needsAttention.failedPayouts, 'shop')} with a failed payout` },
    needsAttention.pendingBanners > 0 && { to: '/vendors?banner=pending', text: `${plural(needsAttention.pendingBanners, 'banner')} to approve` },
    needsAttention.waitingForReview > 0 && { to: '/review-queue', text: `${plural(needsAttention.waitingForReview, 'shop')} waiting for review` },
  ].filter((item): item is { to: string; text: string } => Boolean(item))

  return (
    <>
      <StatGrid label="Day summary">
        <StatCard
          label="Sales"
          value={cedis(orders.sales)}
          note={
            orders.placed === 0
              ? 'No orders'
              : `${plural(orders.placed, 'order')} · ${orders.paidOnline} MoMo/card, ${orders.cash} cash${orders.cancelled ? ` · ${orders.cancelled} cancelled` : ''}`
          }
        />
        <StatCard
          label="MarketiX commission"
          value={cedis(data.commission)}
          note={data.confirmedOrders ? `From ${plural(data.confirmedOrders, 'delivered order')}` : 'No orders delivered'}
          noteTone={data.commission > 0 ? 'success' : 'muted'}
        />
        <StatCard
          label="Paid to vendors"
          value={cedis(data.paidOut.amount)}
          note={[
            data.paidOut.count ? plural(data.paidOut.count, 'MoMo payout') : 'No payouts',
            data.failedPayouts.count ? `${data.failedPayouts.count} failed (${cedis(data.failedPayouts.amount)})` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          noteTone={data.failedPayouts.count ? 'warning' : 'muted'}
        />
        <StatCard label="New shops" value={data.newShops} note={data.newShops ? 'Signed up' : 'No sign-ups'} />
      </StatGrid>

      <MoneyCheck money={money} />

      <div className={styles.columns}>
        <div>
          <h3 className={styles.subtitle}>Top shops</h3>
          {data.topShops.length === 0 ? (
            <p className={styles.muted}>No sales this day.</p>
          ) : (
            <ol className={styles.list}>
              {data.topShops.map((shop) => (
                <li key={shop.id}>
                  <Link to={`/orders/${shop.id}`}>{shop.name}</Link>
                  <span className={styles.muted}>
                    {plural(shop.orders, 'order')} · <strong>{cedis(shop.sales)}</strong>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h3 className={styles.subtitle}>Needs attention now</h3>
          {attention.length === 0 ? (
            <p className={styles.muted}>All clear.</p>
          ) : (
            <ul className={styles.list}>
              {attention.map((item) => (
                <li key={item.to}>
                  <Link to={item.to}>{item.text}</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

/** Right now: can MarketiX pay every vendor what they're owed from its Paystack balance? */
function MoneyCheck({ money }: { money: Summary['money'] }) {
  const { paystackBalance, owedToVendors, shortfall } = money
  return (
    <StatGrid label="Money check, right now">
      <StatCard
        label="Paystack balance"
        value={paystackBalance === null ? '—' : cedis(paystackBalance)}
        note={paystackBalance === null ? 'Couldn’t ask Paystack' : 'Available to pay vendors'}
      />
      <StatCard label="Owed to vendors" value={cedis(owedToVendors)} note="Every balance, card payments on hold included" />
      <StatCard
        label="Covered?"
        value={shortfall === null ? '—' : shortfall > 0 ? `${cedis(shortfall)} short` : 'Yes'}
        valueTone={shortfall ? 'warning' : undefined}
        note={shortfall === null ? 'Unknown until Paystack answers' : shortfall > 0 ? 'Top up Paystack before vendors withdraw' : 'Paystack holds enough'}
        noteTone={shortfall ? 'warning' : shortfall === 0 ? 'success' : 'muted'}
        highlighted={Boolean(shortfall)}
      />
      <StatCard
        label="Stuck payouts"
        value={money.stuckPayouts.count}
        valueTone={money.stuckPayouts.count ? 'warning' : undefined}
        note={money.stuckPayouts.count ? `${cedis(money.stuckPayouts.amount)} on the way 10+ minutes` : 'None'}
        noteTone={money.stuckPayouts.count ? 'warning' : 'success'}
      />
    </StatGrid>
  )
}
