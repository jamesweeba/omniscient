/** Vendor money: the ledger MarketiX keeps per shop and MoMo payouts. Amounts are pesewas. */
import { api, queryString, type ApiPage } from './api'

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'
export type PayoutStatusFilter = 'all' | 'pending' | 'processing' | 'success' | 'failed'
export type LedgerEntryType = 'ORDER_EARNING' | 'CASH_COMMISSION' | 'PAYOUT' | 'PAYOUT_REVERSAL'

export interface Payout {
  id: string
  tenantId: string
  amount: number
  status: PayoutStatus
  reference: string
  transferCode: string | null
  momoNumber: string
  momoName: string | null
  initiatedById: string | null
  failureReason: string | null
  paidAt: string | null
  createdAt: string
}

export interface AdminPayout extends Payout {
  tenant: { id: string; name: string; ref: string }
  /** A newer payout exists for the shop, so a failure here is already dealt with. */
  superseded: boolean
}

export interface LedgerEntry {
  id: string
  type: LedgerEntryType
  /** Positive: owed to the vendor. Negative: paid out, or owed by the vendor. */
  amount: number
  orderId: string | null
  orderNumber: string | null
  details: { items: number; commission: number; deliveryFee: number } | null
  createdAt: string
  payout: Pick<Payout, 'id' | 'status' | 'reference' | 'failureReason' | 'paidAt'> | null
}

export interface ShopMoney {
  /** Owed to the vendor now; negative when they owe commission on cash orders. */
  balance: number
  /** Sent to Paystack, not landed yet. */
  inFlight: number
  totals: { earned: number; commissionOnPaidOrders: number; commissionOnCashOrders: number; paidOut: number }
  /** Paid, delivered orders the buyer hasn't confirmed yet: earned once they do. */
  awaitingConfirmation: { count: number; amount: number; orders: { id: string; orderNumber: string; vendorShare: number; deliveredAt: string }[] }
  lastPayout: Payout | null
  payouts: {
    enabled: boolean
    paused: boolean
    pausedReason: string | null
    /** "Every morning at 7:00 am, Monday to Saturday". */
    schedule: string
    /** The next daily payout run (ISO). */
    nextPayoutAt: string
  }
  momo: { number: string | null; name: string | null }
  commissionPercent: number
  minPayout: number
}

export interface PayoutListQuery {
  status?: PayoutStatusFilter
  search?: string
  page: number
  pageSize: number
}

const listParams = (q: PayoutListQuery) =>
  queryString({ status: q.status === 'all' ? undefined : q.status, search: q.search?.trim(), page: q.page, limit: q.pageSize })

// ── Vendor ──────────────────────────────────────────────────────────────────

export const fetchMyMoney = () => api.get<ShopMoney>('/payouts/summary')

export const fetchMyStatement = (page: number, pageSize: number) =>
  api.get<ApiPage<LedgerEntry>>(`/payouts/statement${queryString({ page, limit: pageSize })}`)

// ── Admin ───────────────────────────────────────────────────────────────────

export interface PayoutsOverview {
  owedToVendors: number
  owedByVendors: number
  failedPayouts: number
  last30Days: { paidOut: number; commission: number }
  payoutsEnabled: boolean
  commissionPercent: number
  schedule: string
  nextPayoutAt: string
}

export interface VendorBalance {
  id: string
  ref: string
  name: string
  momoNumber: string | null
  payoutsPaused: boolean
  balance: number
  inFlight: number
  paidOut: number
  /** The latest payout failed and needs an admin. */
  lastPayoutFailed: boolean
  lastPayoutAt: string | null
}

export const fetchPayoutsOverview = () => api.get<PayoutsOverview>('/admin/payouts/summary')

export const fetchVendorBalances = (q: { search?: string; page: number; pageSize: number }) =>
  api.get<ApiPage<VendorBalance>>(`/admin/payouts/balances${queryString({ search: q.search?.trim(), page: q.page, limit: q.pageSize })}`)

export const fetchAllPayouts = (q: PayoutListQuery) => api.get<ApiPage<AdminPayout>>(`/admin/payouts${listParams(q)}`)

export const retryPayout = (id: string) => api.post<Payout>(`/admin/payouts/${id}/retry`)

export const fetchShopMoney = (vendorId: string) => api.get<ShopMoney>(`/admin/tenants/${vendorId}/payouts/summary`)

export const fetchShopStatement = (vendorId: string, page: number, pageSize: number) =>
  api.get<ApiPage<LedgerEntry>>(`/admin/tenants/${vendorId}/payouts/statement${queryString({ page, limit: pageSize })}`)

export const payVendorNow = (vendorId: string) => api.post<Payout>(`/admin/tenants/${vendorId}/payouts/pay-now`)

export const setPayoutsPaused = (vendorId: string, paused: boolean, reason?: string) =>
  api.post<{ paused: boolean }>(`/admin/tenants/${vendorId}/payouts/pause`, { paused, reason })

/** Pay the vendor for a delivered, paid order the buyer never confirmed. */
export const releaseOrderPayout = (orderId: string) => api.post<{ released: boolean }>(`/admin/orders/${orderId}/release`)

// ── Display ─────────────────────────────────────────────────────────────────

const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', weekday: 'long', day: 'numeric', month: 'short' })
const accraDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra' }) // yyyy-mm-dd

/** "Today, 7:00 am", "Tomorrow, 7:00 am" or "Monday 9 Nov, 7:00 am" (Accra time). */
export function formatPayoutDay(iso: string, now = new Date()): string {
  const day = accraDay.format(new Date(iso))
  const today = accraDay.format(now)
  const tomorrow = accraDay.format(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  const label = day === today ? 'Today' : day === tomorrow ? 'Tomorrow' : dayFormat.format(new Date(iso))
  return `${label}, 7:00 am`
}

/** "GH₵ 1,234.50" from pesewas; negative amounts get a minus sign. */
export function cedis(pesewas: number): string {
  const sign = pesewas < 0 ? '−' : ''
  return `${sign}GH₵ ${(Math.abs(pesewas) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const PAYOUT_STATUS: Record<PayoutStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  PENDING: { label: 'Sending', tone: 'info' },
  PROCESSING: { label: 'On its way', tone: 'info' },
  SUCCESS: { label: 'Paid', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
}

export const LEDGER_ENTRY: Record<LedgerEntryType, string> = {
  ORDER_EARNING: 'Order paid out',
  CASH_COMMISSION: 'Commission on cash order',
  PAYOUT: 'Sent to MoMo',
  PAYOUT_REVERSAL: 'Payout failed: back in balance',
}
