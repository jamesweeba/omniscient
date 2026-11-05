import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/StatusBadge/StatusBadge'
import { daysSince, formatWaiting } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import type { QueuedVendor } from '@/lib/vendors'
import table from '@/styles/table.module.css'
import styles from './ReviewQueue.module.css'

/** Vendors waiting at least this many days are highlighted. */
const LONG_WAIT_DAYS = 4
const COLUMN_COUNT = 8

interface VendorTableProps {
  vendors: QueuedVendor[]
  /** Shown in place of rows when there are none (loading, error, or no matches). */
  emptyMessage: ReactNode
}

export function VendorTable({ vendors, emptyMessage }: VendorTableProps) {
  return (
    <div className={table.scroll}>
      <table className={table.table}>
        <thead>
          <tr>
            <th>Shop</th>
            <th>Owner</th>
            <th>Market</th>
            <th>Products</th>
            <th>KYC</th>
            <th>Waiting</th>
            <th>Status</th>
            <th>
              <span className={table.visuallyHidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {vendors.length === 0 ? (
            <tr>
              <td className={table.emptyCell} colSpan={COLUMN_COUNT}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            vendors.map((vendor) => <VendorRow key={vendor.id} vendor={vendor} />)
          )}
        </tbody>
      </table>
    </div>
  )
}

function VendorRow({ vendor }: { vendor: QueuedVendor }) {
  const kycPercent = Math.round(vendor.kycCompleteness * 100)
  const longWait = vendor.queuedAt !== null && daysSince(vendor.queuedAt) >= LONG_WAIT_DAYS

  return (
    <tr>
      <td>
        <div className={table.stack}>
          <span className={table.primary}>{vendor.shopName}</span>
          <span className={table.secondary}>{vendor.ref}</span>
        </div>
      </td>
      <td>
        <div className={table.stack}>
          <span>{vendor.ownerName}</span>
          {vendor.ownerPhone && <span className={`${table.secondary} ${table.nowrap}`}>{formatPhone(vendor.ownerPhone, 'local')}</span>}
        </div>
      </td>
      <td>{vendor.market ?? <span className={table.muted}>Not set</span>}</td>
      <td>{vendor.productCount}</td>
      <td className={table.nowrap}>
        <div className={styles.kyc}>
          <div
            className={styles.kycTrack}
            role="progressbar"
            aria-label="KYC completeness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={kycPercent}
          >
            <div
              className={kycPercent >= 100 ? styles.kycFillComplete : styles.kycFillPartial}
              style={{ width: `${kycPercent}%` }}
            />
          </div>
          <span className={table.secondary}>{kycPercent}%</span>
        </div>
      </td>
      <td className={`${table.nowrap} ${longWait ? table.warning : ''}`}>
        {vendor.queuedAt ? formatWaiting(vendor.queuedAt) : <span className={table.muted}>Not submitted</span>}
      </td>
      <td>
        <StatusBadge status={vendor.status} />
      </td>
      <td className={table.actionCell}>
        <Link className={table.rowButton} to={`/vendors/${vendor.id}`}>
          Review
        </Link>
      </td>
    </tr>
  )
}
