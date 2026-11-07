import type { BadgeTone } from '@/components/Badge/Badge'
import { api, type ApiPage, queryString } from './api'
import type { PayoutStatus } from './payouts'
import { saleState, type NoCommissionReason } from './promotions'

/** Admin views of promoters: who they are, what they've earned, and their MoMo payouts. Amounts in pesewas. */

export type PromoterStatus = 'SIGNING_UP' | 'ACTIVE' | 'SUSPENDED'
export type PromoterStatusFilter = 'all' | 'active' | 'suspended' | 'signing_up'
export type PromoterPayoutFilter = 'all' | 'failed' | 'processing' | 'success'

export const PROMOTER_STATUS: Record<PromoterStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  SIGNING_UP: { label: 'Signing up', tone: 'neutral' },
}

export interface PromotersSummary {
  promoters: { active: number; suspended: number; signingUp: number }
  owedToPromoters: number
  commissionLast30Days: number
  failedPayouts: number
}

export interface PromoterListItem {
  id: string
  fullName: string | null
  phone: string
  status: PromoterStatus
  suspendedReason: string | null
  createdAt: string
  momo: { number: string | null; name: string | null; verified: boolean }
  /** Shops that approved them. */
  shops: number
  buyers: number
  orders: number
  /** Orders where the buyer or payer was the promoter. */
  ownNumberOrders: number
  earned: number
  balance: number
  available: number
}

export interface PromoterPayoutRow {
  id: string
  createdAt: string
  amount: number
  status: PayoutStatus
  reference: string
  momoNumber: string
  momoName: string | null
  failureReason: string | null
  paidAt: string | null
  /** Sent by an admin (a retry), not withdrawn by the promoter. */
  byAdmin: boolean
  /** Failed, but a newer payout went out after it. */
  superseded: boolean
  promoter: { id: string; fullName: string | null; phone: string } | null
}

export interface PromoterDetail {
  id: string
  fullName: string | null
  phone: string
  status: PromoterStatus
  suspendedReason: string | null
  signupStep: string | null
  createdAt: string
  termsAcceptedAt: string | null
  momo: { number: string | null; network: string | null; name: string | null; verified: boolean }
  money: { balance: number; available: number; onHold: number; nextReleaseAt: string | null; earned: number }
  shops: {
    id: string
    status: 'REQUESTED' | 'INVITED' | 'APPROVED' | 'DECLINED' | 'REMOVED'
    tenant: { id: string; name: string; status: string }
    requestedAt: string
    decidedAt: string | null
    links: { id: string; code: string; productName: string | null; active: boolean }[]
  }[]
  referrals: {
    id: string
    tenant: { id: string; name: string }
    buyerPhone: string
    linkCode: string
    productName: string | null
    ratePercent: number
    tappedAt: string
    order: { id: string; orderNumber: string; status: string; createdAt: string } | null
    commissionAmount: number | null
    state: 'WAITING' | 'EXPIRED' | 'PENDING' | 'EARNED' | 'NO_COMMISSION'
    reason: NoCommissionReason | null
  }[]
  payouts: PromoterPayoutRow[]
  ledger: { id: string; type: 'COMMISSION' | 'PAYOUT' | 'PAYOUT_REVERSAL'; amount: number; orderNumber: string | null; shopName: string | null; availableAt: string | null; createdAt: string }[]
}

export const PROMOTER_LEDGER_ENTRY: Record<PromoterDetail['ledger'][number]['type'], string> = {
  COMMISSION: 'Commission',
  PAYOUT: 'Sent to MoMo',
  PAYOUT_REVERSAL: 'Payout failed: back in balance',
}

/** How a referral stands, in words: a buyer who tapped and hasn't ordered shows as waiting or expired. */
export function referralLabel(r: Pick<PromoterDetail['referrals'][number], 'state' | 'reason'>): { label: string; tone: BadgeTone } {
  if (r.state === 'WAITING') return { label: 'Tapped, no order yet', tone: 'neutral' }
  if (r.state === 'EXPIRED') return { label: 'Expired without an order', tone: 'neutral' }
  return saleState({ state: r.state, reason: r.reason })
}

export const fetchPromotersSummary = () => api.get<PromotersSummary>('/admin/promoters/summary')

export const fetchPromoters = (q: { search?: string; status: PromoterStatusFilter; page: number; pageSize: number }) =>
  api.get<ApiPage<PromoterListItem>>(
    `/admin/promoters${queryString({ search: q.search, status: q.status === 'all' ? undefined : q.status, page: q.page, limit: q.pageSize })}`,
  )

export const fetchPromoter = (id: string) => api.get<PromoterDetail>(`/admin/promoters/${id}`)

export const suspendPromoter = (id: string, reason: string) => api.post<PromoterDetail>(`/admin/promoters/${id}/suspend`, { reason })

export const reinstatePromoter = (id: string) => api.post<PromoterDetail>(`/admin/promoters/${id}/reinstate`)

export const fetchPromoterPayouts = (q: { search?: string; status: PromoterPayoutFilter; page: number; pageSize: number }) =>
  api.get<ApiPage<PromoterPayoutRow>>(
    `/admin/promoter-payouts${queryString({ search: q.search, status: q.status === 'all' ? undefined : q.status, page: q.page, limit: q.pageSize })}`,
  )

export const retryPromoterPayout = (id: string) => api.post<PromoterPayoutRow>(`/admin/promoter-payouts/${id}/retry`)
