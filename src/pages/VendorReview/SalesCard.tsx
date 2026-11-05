import { useCallback } from 'react'
import { Link } from 'react-router'
import { useAsync } from '@/hooks/useAsync'
import { cedis, formatDate, formatStars, plural } from '@/lib/format'
import { fetchShopSales, formatRating, weekChange, type SalesSummary } from '@/lib/payouts'
import type { VendorDetail } from '@/lib/vendors'
import styles from './VendorReview.module.css'


/** How the shop is selling and what buyers think of it: an early warning about a bad vendor. */
export function SalesCard({ vendor }: { vendor: VendorDetail }) {
  const load = useCallback(() => fetchShopSales(vendor.id), [vendor.id])
  const sales = useAsync(load)

  return (
    <section className={styles.card} aria-labelledby="sales">
      <div className={styles.cardHeader}>
        <h2 id="sales" className={styles.cardTitle}>
          Sales and ratings
        </h2>
        <Link className={styles.textLink} to={`/orders/${vendor.id}`}>
          All orders
        </Link>
      </div>
      {sales.status === 'loading' && <p className={styles.mutedText}>Loading…</p>}
      {sales.status === 'error' && <p className={styles.errorText}>{sales.error}</p>}
      {sales.status === 'success' && <SalesContent sales={sales.data} />}
    </section>
  )
}

function SalesContent({ sales }: { sales: SalesSummary }) {
  const { thisWeek, lastWeek, bestSellers, buyers, rating, windowDays } = sales
  const change = weekChange(thisWeek.sales, lastWeek.sales)
  const lowShare = rating.count > 0 && rating.average !== null && rating.average < 3

  return (
    <>
      <dl className={styles.moneyFacts}>
        <div>
          <dt>Last 7 days</dt>
          <dd>
            {cedis(thisWeek.sales)}
            <span className={styles.mutedText}> · {plural(thisWeek.orders, 'order')}</span>
          </dd>
        </div>
        <div>
          <dt>The 7 days before</dt>
          <dd>
            {cedis(lastWeek.sales)}
            <span className={styles.mutedText}> · {plural(lastWeek.orders, 'order')}</span>
          </dd>
        </div>
        <div>
          <dt>Buyers, last {windowDays} days</dt>
          <dd>
            {buyers.total}
            <span className={styles.mutedText}> · {buyers.repeat} came back</span>
          </dd>
        </div>
        <div>
          <dt>Buyer rating</dt>
          <dd className={lowShare ? styles.moneyOwed : undefined}>
            {rating.count === 0 ? '—' : formatRating(rating.average)}
            <span className={styles.mutedText}> · {plural(rating.count, 'rating')}</span>
          </dd>
        </div>
      </dl>
      {change && <p className={styles.mutedText}>{change}.</p>}

      <p className={styles.mutedText}>
        Best sellers, last {windowDays} days:{' '}
        {bestSellers.length === 0 ? 'no sales.' : bestSellers.map((p) => `${p.name} (${p.quantity}, ${cedis(p.sales)})`).join(' · ')}
      </p>

      {rating.recentLow.length > 0 && (
        <p className={styles.flashWarning}>
          Low ratings, last {windowDays} days:{' '}
          {rating.recentLow.map((r) => `${r.orderNumber} ${formatStars(r.rating)} (${formatDate(r.ratedAt)})`).join(' · ')}
        </p>
      )}
    </>
  )
}
