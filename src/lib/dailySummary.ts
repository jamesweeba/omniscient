/** GET /admin/daily-summary: one day of MarketiX at a glance. Amounts are pesewas. */
import { formatLongDay, relativeDay } from './format'
import { api, queryString } from './api'

export interface DailySummary {
  /** yyyy-mm-dd, Accra time. */
  date: string
  previousDate: string
  /** Null when `date` is today. */
  nextDate: string | null
  /** Orders placed that day; `sales` excludes cancelled ones. */
  orders: { placed: number; sales: number; paidOnline: number; cash: number; cancelled: number }
  /** MarketiX's 10% earned that day (paid orders once confirmed, cash orders once delivered). */
  commission: number
  vendorEarnings: number
  confirmedOrders: number
  paidOut: { amount: number; count: number }
  /** Payouts that failed that day (the money went back to the vendors' balances). */
  failedPayouts: { amount: number; count: number }
  newShops: number
  topShops: { id: string; name: string; orders: number; sales: number }[]
  /** Right now, whatever day is shown. */
  needsAttention: { failedPayouts: number; pendingBanners: number; waitingForReview: number; stuckPayouts: number }
  /** Right now: whether MarketiX's Paystack balance covers what vendors are owed. */
  money: {
    /** Still on their way 10+ minutes after they were sent, even after asking Paystack. */
    stuckPayouts: { count: number; amount: number }
    /** Every vendor's positive balance, held card earnings included. */
    owedToVendors: number
    /** Null when Paystack couldn't be asked. */
    paystackBalance: number | null
    /** How much more Paystack needs to cover every balance (0: covered; null: unknown). */
    shortfall: number | null
  }
}

export const fetchDailySummary = (date?: string) => api.get<DailySummary>(`/admin/daily-summary${queryString({ date })}`)

/** "Yesterday", "Today" or "Tuesday 3 November". */
export const formatSummaryDay = (date: string) => relativeDay(date) ?? formatLongDay(date)
