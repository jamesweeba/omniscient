import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import type { AuditEntry } from '@/lib/audit'
import { AUDIT_ACTION } from '@/lib/auditDisplay'
import { formatDateTime, formatTimeAgo } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import table from '@/styles/table.module.css'
import styles from './AuditLog.module.css'

const COLUMN_COUNT = 5

interface AuditTableProps {
  entries: AuditEntry[]
  emptyMessage: ReactNode
}

export function AuditTable({ entries, emptyMessage }: AuditTableProps) {
  return (
    <div className={table.scroll}>
      <table className={table.table}>
        <thead>
          <tr>
            <th>When</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Shop / number</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td className={table.emptyCell} colSpan={COLUMN_COUNT}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            entries.map((entry) => <AuditRow key={entry.id} entry={entry} />)
          )}
        </tbody>
      </table>
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const tone = AUDIT_ACTION[entry.action]?.tone ?? 'neutral'

  return (
    <tr>
      <td className={table.nowrap}>
        <div className={table.stack}>
          <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
          <span className={table.secondary}>{formatTimeAgo(entry.createdAt)}</span>
        </div>
      </td>
      <td className={`${table.nowrap} ${table.primary}`} title={entry.actor.name}>
        {shortName(entry.actor.name)}
      </td>
      <td>
        <Badge tone={tone}>{entry.actionLabel}</Badge>
      </td>
      <td>
        <div className={table.stack}>
          {entry.tenant &&
            (entry.tenant.exists ? (
              <Link to={`/vendors/${entry.tenant.id}`}>{entry.tenant.name}</Link>
            ) : (
              <span title="This shop has been deleted">{entry.tenant.name}</span>
            ))}
          {entry.number && (
            <Link className={`${table.secondary} ${table.nowrap}`} to="/whatsapp-numbers">
              {formatPhone(entry.number.displayNumber)}
            </Link>
          )}
          {!entry.tenant && !entry.number && <span className={table.muted}>—</span>}
        </div>
      </td>
      <td className={styles.note}>{entry.details}</td>
    </tr>
  )
}

/** "Steph Dua" → "Steph D." */
function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first
}
