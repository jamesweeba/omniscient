import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { StatusBadge } from '@/components/StatusBadge/StatusBadge'
import { daysSince, formatDate, formatTimeAgo } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { QUEUE_STATUSES } from '@/lib/vendorStatus'
import type { VendorListItem } from '@/lib/vendors'
import table from '@/styles/table.module.css'
import type { VendorLinkState } from '../VendorReview/VendorReview'

/** Active shops without an order for this many days are highlighted. */
const QUIET_SHOP_DAYS = 14
const COLUMN_COUNT = 8

interface VendorsTableProps {
  vendors: VendorListItem[]
  /** Shown in place of rows when there are none (loading, error, or no matches). */
  emptyMessage: ReactNode
}

export function VendorsTable({ vendors, emptyMessage }: VendorsTableProps) {
  return (
    <div className={table.scroll}>
      <table className={table.table}>
        <thead>
          <tr>
            <th>Shop</th>
            <th>Owner</th>
            <th>Market</th>
            <th>Status</th>
            <th>WhatsApp number</th>
            <th>Orders (30d)</th>
            <th>Joined</th>
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

function VendorRow({ vendor }: { vendor: VendorListItem }) {
  const location = useLocation()
  const backState: VendorLinkState = {
    backTo: location.pathname + location.search,
    backLabel: 'Back to vendors',
  }
  const inQueue = QUEUE_STATUSES.includes(vendor.status)
  const quiet =
    vendor.status === 'ACTIVE' &&
    (!vendor.lastOrderAt || daysSince(vendor.lastOrderAt) >= QUIET_SHOP_DAYS)

  return (
    <tr>
      <td>
        <div className={table.stack}>
          <span className={table.primary}>{vendor.shopName}</span>
          <span className={table.secondary}>
            {vendor.ref}
            {vendor.noteCount > 0 && ` · ${vendor.noteCount} ${vendor.noteCount === 1 ? 'note' : 'notes'}`}
          </span>
          {vendor.bannerPending && <span className={`${table.secondary} ${table.warning}`}>Banner waiting for approval</span>}
        </div>
      </td>
      <td>
        <div className={table.stack}>
          <span>{vendor.ownerName}</span>
          {vendor.ownerPhone && <span className={`${table.secondary} ${table.nowrap}`}>{formatPhone(vendor.ownerPhone, 'local')}</span>}
        </div>
      </td>
      <td>{vendor.market ?? <span className={table.muted}>Not set</span>}</td>
      <td>
        <StatusBadge status={vendor.status} />
      </td>
      <td className={table.nowrap}>
        {vendor.whatsAppNumber ? (
          <div className={table.stack}>
            <span>{formatPhone(vendor.whatsAppNumber)}</span>
            {vendor.status === 'SUSPENDED' && <span className={table.secondary}>Kept while suspended</span>}
          </div>
        ) : (
          <span className={table.muted}>—</span>
        )}
      </td>
      <td>
        <div className={table.stack}>
          <span>{vendor.ordersLast30Days}</span>
          {(vendor.lastOrderAt || vendor.status === 'ACTIVE') && (
            <span className={`${table.secondary} ${table.nowrap} ${quiet ? table.warning : ''}`}>
              {vendor.lastOrderAt ? `Last ${formatTimeAgo(vendor.lastOrderAt)}` : 'No orders yet'}
            </span>
          )}
        </div>
      </td>
      <td className={table.nowrap}>{formatDate(vendor.joinedAt)}</td>
      <td className={table.actionCell}>
        <Link className={inQueue ? table.rowButton : table.rowButtonSecondary} to={`/vendors/${vendor.id}`} state={backState}>
          {inQueue ? 'Review' : 'View'}
        </Link>
      </td>
    </tr>
  )
}
