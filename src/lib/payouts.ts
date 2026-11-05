/** Vendor money: the ledger MarketiX keeps per shop and MoMo payouts. Amounts are pesewas. */
import { api, queryString, type ApiPage } from './api'

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'
export type PayoutStatusFilter = 'all' | 'pending' | 'processing' | 'success' | 'failed'
export type PayoutSource = 'VENDOR' | 'ADMIN' | 'AUTOMATIC'
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
  /** Who started it. Payouts from before withdrawals came in are AUTOMATIC (the old 7 am run). */
  source?: PayoutSource
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
  /** Card earnings are held until then before they can be withdrawn. Null: right away. */
  availableAt?: string | null
  createdAt: string
  payout: Pick<Payout, 'id' | 'status' | 'reference' | 'failureReason' | 'paidAt'> | null
}

export interface ShopMoney {
  /** Owed to the vendor now; negative when they owe commission on cash orders. */
  balance: number
  /** The part of the balance that can be withdrawn now (held card earnings can't). */
  available: number
  /** Card earnings held for `days` days before they can be withdrawn; `nextReleaseAt` is the soonest (ISO). */
  onHold: { amount: number; nextReleaseAt: string | null; days: number }
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
    /**
     * Set when the vendor has already withdrawn today (Accra time): the next midnight in Accra,
     * when they can withdraw again (ISO). Null when they can withdraw today.
     */
    nextWithdrawalAt: string | null
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

/** Send `amount` pesewas of the balance to the vendor's MoMo. Once per day (Accra time). */
export const requestWithdrawal = (amount: number) => api.post<Payout>('/payouts/withdraw', { amount })

export type WithdrawState = { canWithdraw: true } | { canWithdraw: false; reason: string }

/**
 * Whether the vendor can withdraw now, and if not, why (in words for the vendor).
 * The server checks all of this again and answers 409 with its own reason.
 */
export function withdrawState(money: ShopMoney): WithdrawState {
  const { payouts, available, onHold, inFlight, minPayout, momo } = money
  const no = (reason: string): WithdrawState => ({ canWithdraw: false, reason })
  if (payouts.paused) return no('Withdrawals for your shop are on hold. MarketiX will contact you.')
  if (!payouts.enabled) return no('Withdrawals to MoMo start soon. Your balance is safe and you can withdraw all of it then.')
  if (!momo.number) return no('Add your MoMo number in Shop details before you withdraw.')
  if (inFlight > 0) return no('Wait for the money on its way to land before you withdraw again.')
  if (payouts.nextWithdrawalAt) return no(`You can withdraw once a day. Next withdrawal: ${formatWithdrawalDay(payouts.nextWithdrawalAt)}.`)
  if (available < minPayout) {
    return no(
      onHold.amount > 0 && onHold.nextReleaseAt
        ? `Card payments can be withdrawn ${onHold.days} days after the buyer confirms. Your next one is ready on ${formatReleaseTime(onHold.nextReleaseAt)}.`
        : `You can withdraw once your balance reaches ${cedis(minPayout)}.`,
    )
  }
  return { canWithdraw: true }
}

export interface SalesSummary {
  /** Best sellers, buyers and low ratings look back this many days. */
  windowDays: number
  /** The last 7 days, and the 7 before. Paid (and confirmed cash) orders, not cancelled ones. */
  thisWeek: { sales: number; orders: number }
  lastWeek: { sales: number; orders: number }
  /** Top 5 over the window, by sales. */
  bestSellers: { productId: string | null; name: string; quantity: number; sales: number }[]
  /** Buyers who ordered in the window; `repeat` of them have ordered more than once. */
  buyers: { total: number; repeat: number }
  /** Buyer ratings (1-5) of delivered orders, all time; the low ones from the window. */
  rating: { average: number | null; count: number; recentLow: { orderId: string; orderNumber: string; rating: number; ratedAt: string }[] }
}

export const fetchMySales = () => api.get<SalesSummary>('/payouts/sales')

// ── Admin ───────────────────────────────────────────────────────────────────

export interface PayoutsOverview {
  owedToVendors: number
  owedByVendors: number
  failedPayouts: number
  last30Days: { paidOut: number; commission: number }
  payoutsEnabled: boolean
  commissionPercent: number
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

export const fetchShopSales = (vendorId: string) => api.get<SalesSummary>(`/admin/tenants/${vendorId}/sales-summary`)

export const payVendorNow = (vendorId: string) => api.post<Payout>(`/admin/tenants/${vendorId}/payouts/pay-now`)

/** Stop or restart the shop's withdrawals. */
export const setPayoutsPaused = (vendorId: string, paused: boolean, reason?: string) =>
  api.post<{ paused: boolean }>(`/admin/tenants/${vendorId}/payouts/pause`, { paused, reason })

/** Pay the vendor for a delivered, paid order the buyer never confirmed. */
export const releaseOrderPayout = (orderId: string) => api.post<{ released: boolean }>(`/admin/orders/${orderId}/release`)

// ── Display ─────────────────────────────────────────────────────────────────

const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', weekday: 'long', day: 'numeric', month: 'short' })
const accraDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra' }) // yyyy-mm-dd

/** "tomorrow" when `iso` is the next day in Accra, else "Monday 9 Nov". */
export function formatWithdrawalDay(iso: string, now = new Date()): string {
  const tomorrow = accraDay.format(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  return accraDay.format(new Date(iso)) === tomorrow ? 'tomorrow' : dayFormat.format(new Date(iso))
}

const releaseFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "Sun 8 Nov, 14:30" (Accra time). */
export const formatReleaseTime = (iso: string) => releaseFormat.format(new Date(iso))

/** "+12%" or "−5%" from last week to this week; null when there's nothing to compare with. */
export function weekChange(thisWeek: number, lastWeek: number): string | null {
  if (lastWeek <= 0) return null
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  return pct === 0 ? 'Same as the week before' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% on the week before`
}

/** "4.3 ★" style average, or null with no ratings. */
export const formatRating = (average: number | null) => (average === null ? null : `${average.toFixed(1)} ★`)

/** Pesewas from what the vendor typed ("150", "150.5", "1,200.00"); null if it isn't an amount. */
export function parseCedis(text: string): number | null {
  const clean = text.replace(/[,\s]/g, '').replace(/^GH₵/i, '')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  return Math.round(Number(clean) * 100)
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

/** "Vendor withdrawal", "Sent by an admin" or "Automatic". */
export function payoutSourceLabel(p: Pick<Payout, 'source' | 'initiatedById'>): string {
  const source = p.source ?? (p.initiatedById ? 'ADMIN' : 'AUTOMATIC')
  return source === 'VENDOR' ? 'Vendor withdrawal' : source === 'ADMIN' ? 'Sent by an admin' : 'Automatic'
}

export const LEDGER_ENTRY: Record<LedgerEntryType, string> = {
  ORDER_EARNING: 'Order paid out',
  CASH_COMMISSION: 'Commission on cash order',
  PAYOUT: 'Withdrawn to MoMo',
  PAYOUT_REVERSAL: 'Withdrawal failed: back in balance',
}
