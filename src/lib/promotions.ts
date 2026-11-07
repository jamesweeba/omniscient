import { api, type ApiPage } from './api'

/** The shop's promoter settings (GET /promotions/settings). */
export interface PromotionSettings {
  promotionsEnabled: boolean
  /** Listed on the promoter bot so new promoters can ask to join. Invites work either way. */
  acceptPromoterRequests: boolean
  /** Whole percent of the items, or null before it's set. */
  promoterRate: number | null
  /** MarketiX's own commission, which the vendor pays too. */
  platformCommissionPercent: number
  minRate: number
  maxRate: number
  shopLive: boolean
}

export type MembershipStatus = 'REQUESTED' | 'INVITED' | 'APPROVED' | 'DECLINED' | 'REMOVED'

export interface PromoLinkRow {
  id: string
  code: string
  /** Null: the whole shop. */
  productId: string | null
  productName: string | null
  createdAt: string
}

/** A request, invite or promoter of the shop. */
export interface PromoterRow {
  id: string
  status: MembershipStatus
  requestedAt: string
  decidedAt: string | null
  removedAt: string | null
  /** Null for an invite nobody has accepted yet. */
  promoter: { id: string; fullName: string | null; phone: string; momoName: string | null; momoVerified: boolean } | null
  invite: {
    phone: string
    code: string | null
    /** Empty: the whole shop. */
    productIds: string[]
    /** Null when the platform number isn't set up yet. */
    joinLink: string | null
    /** Ready to send from the vendor's WhatsApp. */
    message: string | null
  } | null
  /** Active links only. */
  links: PromoLinkRow[]
  /** Pesewas. Null for an invite nobody has accepted. */
  stats: PromoterStats | null
}

export interface PromoterStats {
  /** Different buyers who tapped their links. */
  buyers: number
  /** First orders credited to them (not cancelled). */
  orders: number
  /** What those orders' commission is on, in pesewas. */
  sales: number
  /** Commission on orders that earn or still may, in pesewas. */
  commission: number
}

export type ReferralState = 'PENDING' | 'EARNED' | 'NO_COMMISSION'
export type NoCommissionReason = 'CANCELLED' | 'CASH' | 'OWN_NUMBER' | 'PRODUCT_NOT_IN_ORDER'

/** An order credited to a promoter (GET /promotions/sales). Amounts in pesewas. */
export interface PromoterSale {
  id: string
  order: { id: string; orderNumber: string; status: string; paymentMethod: string | null; createdAt: string } | null
  promoter: { id: string; fullName: string | null }
  link: { code: string; productId: string | null; productName: string | null }
  ratePercent: number
  baseAmount: number
  commissionAmount: number
  state: ReferralState
  reason: NoCommissionReason | null
}

export const SALES_PAGE_SIZE = 10

export const fetchPromoterSales = (page: number) => api.get<ApiPage<PromoterSale>>(`/promotions/sales?page=${page}&limit=${SALES_PAGE_SIZE}`)

const NO_COMMISSION: Record<NoCommissionReason, string> = {
  CANCELLED: 'Order cancelled',
  CASH: 'Paid in cash',
  OWN_NUMBER: "Promoter's own number",
  PRODUCT_NOT_IN_ORDER: 'Product not in the order',
}

/** How a credited order's commission stands, in words and badge colour. */
export function saleState(sale: Pick<PromoterSale, 'state' | 'reason'>): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (sale.state === 'EARNED') return { label: 'Earned', tone: 'success' }
  if (sale.state === 'PENDING') return { label: 'Waiting for payment or delivery', tone: 'warning' }
  return { label: `No commission: ${sale.reason ? NO_COMMISSION[sale.reason].toLowerCase() : 'not eligible'}`, tone: 'neutral' }
}

export const fetchPromotionSettings = () => api.get<PromotionSettings>('/promotions/settings')

export const updatePromotionSettings = (changes: Partial<Pick<PromotionSettings, 'promotionsEnabled' | 'acceptPromoterRequests' | 'promoterRate'>>) =>
  api.patch<PromotionSettings>('/promotions/settings', changes)

export const fetchPromoters = () => api.get<PromoterRow[]>('/promotions/promoters')

/** Empty `productIds`: the whole shop. */
export const approvePromoter = (id: string, productIds: string[]) => api.post<PromoterRow>(`/promotions/requests/${id}/approve`, { productIds })

export const declinePromoter = (id: string) => api.post<PromoterRow>(`/promotions/requests/${id}/decline`)

export const invitePromoter = (phone: string, productIds: string[]) => api.post<PromoterRow>('/promotions/invites', { phone, productIds })

export const cancelInvite = (id: string) => api.delete<unknown>(`/promotions/invites/${id}`)

/** No product: a whole-shop link. */
export const addPromoLink = (id: string, productId?: string) => api.post<PromoterRow>(`/promotions/promoters/${id}/links`, productId ? { productId } : {})

export const removePromoLink = (linkId: string) => api.delete<unknown>(`/promotions/links/${linkId}`)

export const removePromoter = (id: string) => api.delete<PromoterRow>(`/promotions/promoters/${id}`)

/**
 * What the vendor keeps of a GH₵ 100 order's items at a given promoter rate, for the
 * settings example: 100 − MarketiX − promoter.
 */
export const keepsOf100 = (promoterRate: number, platformPercent: number) => 100 - platformPercent - promoterRate

export const linkLabel = (link: Pick<PromoLinkRow, 'productName'>) => link.productName ?? 'Whole shop'
