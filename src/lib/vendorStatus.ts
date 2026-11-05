import { type StatusDisplay } from '@/components/Badge/Badge'
import type { VendorStatus, VendorTabKey } from './vendors'

/** Admin badges for each shop status. */
export const VENDOR_STATUS: Record<VendorStatus, StatusDisplay> = {
  PENDING_NO_PRODUCTS: { label: 'Pending', tone: 'neutral' },
  READY_FOR_REVIEW: { label: 'Waiting', tone: 'info' },
  UNDER_REVIEW: { label: 'In review', tone: 'info' },
  MORE_INFO_REQUESTED: { label: 'More info', tone: 'warning' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  ACTIVE: { label: 'Active', tone: 'success' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
}

/** Shops the reviewer can still act on: waiting, in review, or waiting on the vendor. */
export const QUEUE_STATUSES: VendorStatus[] = ['READY_FOR_REVIEW', 'UNDER_REVIEW', 'MORE_INFO_REQUESTED', 'PENDING_NO_PRODUCTS']

/** Filter chips on the review queue. The first is the default. */
export const QUEUE_FILTERS: { key: string; label: string; statuses: VendorStatus[] }[] = [
  { key: 'waiting', label: 'Waiting for review', statuses: ['READY_FOR_REVIEW', 'UNDER_REVIEW'] },
  { key: 'more-info', label: 'More info', statuses: ['MORE_INFO_REQUESTED'] },
  { key: 'not-submitted', label: 'Not submitted', statuses: ['PENDING_NO_PRODUCTS'] },
  { key: 'rejected', label: 'Rejected', statuses: ['REJECTED'] },
]

/** Tabs on the Vendors page (the backend's `tab` values). */
export const VENDOR_TABS: { key: VendorTabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending_review', label: 'Pending review' },
  { key: 'more_info', label: 'More info' },
  { key: 'not_submitted', label: 'Not submitted' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'rejected', label: 'Rejected' },
]
