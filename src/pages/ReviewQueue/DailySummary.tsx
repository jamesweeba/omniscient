import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { StatCard, StatGrid } from '@/components/StatCard/StatCard'
import { useAsync } from '@/hooks/useAsync'
import { fetchDailySummary, formatSummaryDay, type DailySummary as Summary } from '@/lib/dailySummary'
import { cedis } from '@/lib/payouts'
import styles from './DailySummary.module.css'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

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
  const { orders, needsAttention } = data
  const attention = [
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
          note={data.paidOut.count ? `${plural(data.paidOut.count, 'MoMo payout')}` : 'No payouts'}
        />
        <StatCard label="New shops" value={data.newShops} note={data.newShops ? 'Signed up' : 'No sign-ups'} />
      </StatGrid>

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
