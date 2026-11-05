import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import { DAY, formatDateTime, formatShortDate } from '@/lib/format'
import { NUMBER_QUALITY, NUMBER_STATUS, formatMessagingLimit, maskPhoneNumberId } from '@/lib/numberDisplay'
import { COOLING_DAYS, type PoolNumber } from '@/lib/numbers'
import { formatPhone } from '@/lib/phone'
import table from '@/styles/table.module.css'
import styles from './NumberPool.module.css'

const COLUMN_COUNT = 8

interface NumberTableProps {
  numbers: PoolNumber[]
  emptyMessage: ReactNode
  /** Row with an action in flight. */
  busyId: string | null
  onAssign: (number: PoolNumber) => void
  onRelease: (number: PoolNumber) => void
  onFreeNow: (number: PoolNumber) => void
  onRefresh: (number: PoolNumber) => void
}

export function NumberTable({ numbers, emptyMessage, ...actions }: NumberTableProps) {
  return (
    <div className={table.scroll}>
      <table className={`${table.table} ${styles.table}`}>
        <thead>
          <tr>
            <th>Number</th>
            <th>Status</th>
            <th>Assigned shop</th>
            <th>Display name</th>
            <th>Quality</th>
            <th>Tier</th>
            <th>Since</th>
            <th>
              <span className={table.visuallyHidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {numbers.length === 0 ? (
            <tr>
              <td className={table.emptyCell} colSpan={COLUMN_COUNT}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            numbers.map((number) => <NumberRow key={number.id} number={number} {...actions} />)
          )}
        </tbody>
      </table>
    </div>
  )
}

type NumberRowProps = Omit<NumberTableProps, 'numbers' | 'emptyMessage'> & { number: PoolNumber }

function NumberRow({ number, busyId, onAssign, onRelease, onFreeNow, onRefresh }: NumberRowProps) {
  const status = NUMBER_STATUS[number.status]
  const busy = busyId === number.id

  return (
    <tr className={number.qualityIssue ? styles.rowIssue : undefined}>
      <td>
        <div className={table.stack}>
          <span className={`${table.primary} ${table.nowrap}`}>{formatPhone(number.phone)}</span>
          <span className={table.secondary} title={`Meta phone number ID ${number.phoneNumberId}`}>
            {maskPhoneNumberId(number.phoneNumberId)}
          </span>
        </div>
      </td>
      <td>
        <Badge tone={status.tone}>{status.label}</Badge>
      </td>
      <td>
        {number.vendor ? (
          <div className={table.stack}>
            <Link to={`/vendors/${number.vendor.id}`}>{number.vendor.shopName}</Link>
            {number.vendor.status === 'SUSPENDED' && <span className={table.secondary}>Suspended · keeps the number</span>}
          </div>
        ) : (
          <span className={table.muted}>—</span>
        )}
      </td>
      <td className={table.muted}>{number.displayName ?? '—'}</td>
      <td className={table.nowrap}>
        <div className={table.stack}>
          <span className={styles.quality}>
            <span className={styles[`quality_${number.quality}`]} aria-hidden="true" />
            {NUMBER_QUALITY[number.quality]}
          </span>
          <span className={table.secondary}>
            {number.refreshedAt ? `Checked ${formatDateTime(number.refreshedAt)}` : 'Never checked'}
          </span>
        </div>
      </td>
      <td className={`${table.muted} ${table.nowrap}`}>{formatMessagingLimit(number.messagingLimit)}</td>
      <td className={`${table.muted} ${table.nowrap}`}>{since(number)}</td>
      <td className={table.actionCell}>
        <span className={styles.actions}>
          <button className={styles.action} type="button" disabled={busy} onClick={() => onRefresh(number)} title="Fetch quality and tier from Meta">
            {busy ? '…' : 'Refresh'}
          </button>
          {number.status === 'FREE' && (
            <button className={styles.actionAssign} type="button" disabled={busy} onClick={() => onAssign(number)}>
              Assign
            </button>
          )}
          {number.status === 'ASSIGNED' && (
            <button className={styles.action} type="button" disabled={busy} onClick={() => onRelease(number)}>
              Release
            </button>
          )}
          {number.status === 'COOLING' && (
            <button className={styles.action} type="button" disabled={busy} onClick={() => onFreeNow(number)}>
              Free now
            </button>
          )}
        </span>
      </td>
    </tr>
  )
}

function since(number: PoolNumber): string {
  if (number.status === 'ASSIGNED' && number.assignedAt) return `Assigned ${formatShortDate(number.assignedAt)}`
  if (number.status === 'COOLING' && number.releasedAt) {
    const freeOn = new Date(new Date(number.releasedAt).getTime() + COOLING_DAYS * DAY).toISOString()
    return `Free on ${formatShortDate(freeOn)}`
  }
  return `Registered ${formatShortDate(number.registeredAt)}`
}
