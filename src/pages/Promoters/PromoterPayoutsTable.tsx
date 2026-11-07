import { Link } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import { useAction } from '@/hooks/useAction'
import { cedis, formatDateTime } from '@/lib/format'
import { PAYOUT_STATUS } from '@/lib/payouts'
import { formatPhone } from '@/lib/phone'
import { retryPromoterPayout, type PromoterPayoutRow } from '@/lib/promotersAdmin'
import table from '@/styles/table.module.css'

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
  const { pending, error, run } = useAction()
  const display = PAYOUT_STATUS[payout.status]
  const superseded = payout.superseded && payout.status === 'FAILED'

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
      <td className={table.nowrap}>
        <strong>{cedis(payout.amount)}</strong>
      </td>
      <td className={table.nowrap}>
        <div className={table.stack}>
          <span>{formatPhone(payout.momoNumber, 'local')}</span>
          {payout.momoName && <span className={table.secondary}>{payout.momoName}</span>}
        </div>
      </td>
      <td>
        <div className={table.stack}>
          <span>
            <Badge tone={superseded ? 'neutral' : display.tone}>{superseded ? 'Failed · sent again later' : display.label}</Badge>
          </span>
          {payout.status === 'SUCCESS' && payout.paidAt && <span className={table.secondary}>{formatDateTime(payout.paidAt)}</span>}
          {payout.failureReason && <span className={`${table.secondary} ${table.warning}`}>{payout.failureReason}</span>}
          {error && (
            <span className={`${table.secondary} ${table.warning}`} role="alert">
              {error}
            </span>
          )}
        </div>
      </td>
      <td className={table.actionCell}>
        {payout.status === 'FAILED' && !payout.superseded && (
          <button
            className={table.rowButton}
            type="button"
            disabled={pending}
            onClick={() => run(() => retryPromoterPayout(payout.id), { fallback: 'Couldn’t retry. Please try again.' })}
          >
            {pending ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </td>
    </tr>
  )
}
