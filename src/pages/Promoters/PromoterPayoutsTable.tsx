import { Link } from 'react-router'
import { formatDateTime } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { retryPromoterPayout, type PromoterPayoutRow } from '@/lib/promotersAdmin'
import table from '@/styles/table.module.css'
import { PayoutCells } from '../Payouts/PayoutCells'

/** Promoter MoMo payouts, with Retry on the latest failed one. `showPromoter`: a column naming the promoter (off on their own page). */
export function PromoterPayoutsTable({ payouts, emptyMessage, showPromoter = true }: { payouts: PromoterPayoutRow[]; emptyMessage: string; showPromoter?: boolean }) {
  const columns = showPromoter ? 6 : 5
  return (
    <div className={table.scroll}>
      <table className={table.table}>
        <thead>
          <tr>
            <th>When</th>
            {showPromoter && <th>Promoter</th>}
            <th>Amount</th>
            <th>MoMo</th>
            <th>Status</th>
            <th>
              <span className={table.visuallyHidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {payouts.length === 0 ? (
            <tr>
              <td className={table.emptyCell} colSpan={columns}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            payouts.map((p) => <PayoutRow key={p.id} payout={p} showPromoter={showPromoter} />)
          )}
        </tbody>
      </table>
    </div>
  )
}

function PayoutRow({ payout, showPromoter }: { payout: PromoterPayoutRow; showPromoter: boolean }) {
  return (
    <tr>
      <td className={table.nowrap}>
        <div className={table.stack}>
          <span>{formatDateTime(payout.createdAt)}</span>
          <span className={table.secondary}>{payout.byAdmin ? 'Sent by an admin' : 'Promoter withdrawal'}</span>
        </div>
      </td>
      {showPromoter && (
        <td>
          {payout.promoter ? (
            <div className={table.stack}>
              <Link className={table.primary} to={`/promoters/${payout.promoter.id}`}>
                {payout.promoter.fullName ?? 'Unnamed promoter'}
              </Link>
              <span className={table.secondary}>{formatPhone(payout.promoter.phone, 'local')}</span>
            </div>
          ) : (
            <span className={table.muted}>—</span>
          )}
        </td>
      )}
      <PayoutCells payout={payout} retry={() => retryPromoterPayout(payout.id)} />
    </tr>
  )
}
