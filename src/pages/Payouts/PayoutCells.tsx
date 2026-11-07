import { Badge } from '@/components/Badge/Badge'
import { useAction } from '@/hooks/useAction'
import { cedis, formatDateTime } from '@/lib/format'
import { PAYOUT_STATUS, type Payout } from '@/lib/payouts'
import { formatPhone } from '@/lib/phone'
import table from '@/styles/table.module.css'

type PayoutFields = Pick<Payout, 'amount' | 'status' | 'momoNumber' | 'momoName' | 'failureReason' | 'paidAt'> & {
  /** Failed, but a newer payout went out after it. */
  superseded: boolean
}

/**
 * The Amount, MoMo, Status and action cells of a payout row, shared by the shop and promoter
 * payout tables. `retry` sends a failed payout again; Retry shows on the latest failed one.
 */
export function PayoutCells({ payout, retry }: { payout: PayoutFields; retry: () => Promise<unknown> }) {
  const { pending, error, run } = useAction()
  const display = PAYOUT_STATUS[payout.status]
  const superseded = payout.superseded && payout.status === 'FAILED'

  return (
    <>
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
          <button className={table.rowButton} type="button" disabled={pending} onClick={() => run(retry, { fallback: 'Couldn’t retry. Please try again.' })}>
            {pending ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </td>
    </>
  )
}
