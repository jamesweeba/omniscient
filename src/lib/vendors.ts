/** Admin view of shops: the review queue, the directory, the review screen and its actions. */
import { api, apiBlob, type ApiPage, isConflict, type Paginated, queryString, toPaginated } from './api'
import { DOCUMENT_SLOTS } from './documentSlots'
import { toPoolNumber, type ApiNumber, type PoolNumber } from './numbers'
import { TENANT_TO_VENDOR_STATUS, VENDOR_TO_TENANT_STATUS, type TenantStatus } from './tenants'
import type { ChecklistStep, DeliveryArea, DeliverySlot, DocumentType, Product, ShopBanner, ShopDocument } from './vendorPortal'

export type VendorStatus =
  | 'READY_FOR_REVIEW'
  | 'UNDER_REVIEW'
  | 'MORE_INFO_REQUESTED'
  | 'PENDING_NO_PRODUCTS'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REJECTED'

// ---------------------------------------------------------------------------
// Dashboard and review queue
// ---------------------------------------------------------------------------

export interface AdminSummary {
  waitingForReview: number
  moreInfoRequested: number
  freeWhatsAppNumbers: number
  activeShops: number
  /** Shops with a banner waiting for an admin's approval. */
  bannersToApprove: number
  /** Product videos waiting for an admin's approval. */
  videosToApprove: number
}

/** GET /admin/summary: the four dashboard tiles (also the sidebar badges). */
export const fetchAdminSummary = (): Promise<AdminSummary> =>
  api
    .get<{ waiting: number; moreInfo: number; freeNumbers: number; activeShops: number; pendingBanners: number; pendingVideos?: number }>('/admin/summary')
    .then((s) => ({
      waitingForReview: s.waiting,
      moreInfoRequested: s.moreInfo,
      freeWhatsAppNumbers: s.freeNumbers,
      activeShops: s.activeShops,
      bannersToApprove: s.pendingBanners,
      videosToApprove: s.pendingVideos ?? 0,
    }))

export interface QueuedVendor {
  id: string
  ref: string
  shopName: string
  ownerName: string
  ownerPhone: string | null
  market: string | null
  productCount: number
  /** Share of KYC items done, 0–1. */
  kycCompleteness: number
  /** When the vendor sent the shop for review; null if not yet submitted. */
  queuedAt: string | null
  status: VendorStatus
}

interface ApiTenantListItem {
  id: string
  ref: string
  name: string
  ownerFullName: string
  ownerPhone: string | null
  market: string | null
  status: TenantStatus
  productCount: number
  kycCompleteness: number
  submittedAt: string | null
}

/** GET /admin/tenants for the given statuses, oldest submission first (the full list, no paging). */
export async function fetchReviewQueue(statuses: VendorStatus[]): Promise<QueuedVendor[]> {
  const query = statuses.map((s) => VENDOR_TO_TENANT_STATUS[s]).join(',')
  const tenants = await api.get<ApiTenantListItem[]>(`/admin/tenants?status=${query}`)
  return tenants.map((t) => ({
    id: t.id,
    ref: t.ref,
    shopName: t.name,
    ownerName: t.ownerFullName,
    ownerPhone: t.ownerPhone,
    market: t.market,
    productCount: t.productCount,
    kycCompleteness: t.kycCompleteness,
    queuedAt: t.submittedAt,
    status: TENANT_TO_VENDOR_STATUS[t.status],
  }))
}

// ---------------------------------------------------------------------------
// Vendors directory
// ---------------------------------------------------------------------------

export type VendorTabKey = 'all' | 'not_submitted' | 'pending_review' | 'more_info' | 'active' | 'suspended' | 'rejected'

export type VendorSort = 'newest' | 'orders'

export interface VendorListItem {
  id: string
  ref: string
  shopName: string
  ownerName: string
  ownerPhone: string | null
  market: string | null
  status: VendorStatus
  /** Null until approved; kept while suspended. */
  whatsAppNumber: string | null
  /** Paid (or later) orders in the last 30 days. */
  ordersLast30Days: number
  lastOrderAt: string | null
  joinedAt: string
  /** Private admin notes on the shop. */
  noteCount: number
  /** A new banner is waiting for approval. */
  bannerPending: boolean
}

export interface VendorListQuery {
  tab: VendorTabKey
  search?: string
  market?: string
  /** Only shops with a banner waiting for approval. */
  bannerPending?: boolean
  sort: VendorSort
  /** 1-based. */
  page: number
  pageSize: number
}

export interface VendorListResponse extends Paginated<VendorListItem> {
  /** Matches per tab for the search and market filters, for tab badges. */
  counts: Record<VendorTabKey, number>
}

interface ApiVendorListItem {
  id: string
  ref: string
  name: string
  ownerFullName: string
  ownerPhone: string | null
  market: string | null
  status: TenantStatus
  whatsappNumber: string | null
  orders30d: number
  lastOrderAt: string | null
  createdAt: string
  noteCount: number
  bannerPending: boolean
}

export async function fetchVendors(query: VendorListQuery): Promise<VendorListResponse> {
  const result = await api.get<ApiPage<ApiVendorListItem> & { counts: Record<VendorTabKey, number> }>(
    `/admin/vendors${queryString({
      tab: query.tab,
      search: query.search,
      market: query.market,
      banner: query.bannerPending ? 'pending' : undefined,
      sort: query.sort,
      page: query.page,
      limit: query.pageSize,
    })}`,
  )
  return {
    ...toPaginated(result, (v) => ({
      id: v.id,
      ref: v.ref,
      shopName: v.name,
      ownerName: v.ownerFullName,
      ownerPhone: v.ownerPhone,
      market: v.market,
      status: TENANT_TO_VENDOR_STATUS[v.status],
      whatsAppNumber: v.whatsappNumber,
      ordersLast30Days: v.orders30d,
      lastOrderAt: v.lastOrderAt,
      joinedAt: v.createdAt,
      noteCount: v.noteCount,
      bannerPending: v.bannerPending,
    })),
    counts: result.counts,
  }
}

/** Markets for the filter, busiest first. */
export const fetchMarkets = (): Promise<{ market: string; count: number }[]> =>
  api.get<{ market: string; count: number }[]>('/admin/vendors/markets')

// ---------------------------------------------------------------------------
// Review screen
// ---------------------------------------------------------------------------

export interface ReviewChecks {
  ghanaCardMatches: boolean
  momoNameMatches: boolean
  calledOwner: boolean
  productsLookGenuine: boolean
}

export type ChecklistKey = keyof ReviewChecks

export const NO_CHECKS: ReviewChecks = {
  ghanaCardMatches: false,
  momoNameMatches: false,
  calledOwner: false,
  productsLookGenuine: false,
}

export type ReviewDecision = 'APPROVED' | 'MORE_INFO' | 'REJECTED' | 'SUSPENDED' | 'RELEASED' | 'REINSTATED'

/** A shop's document as admins see it: with its slot's title. */
export interface VendorDocument extends ShopDocument {
  title: string
}

export interface ReviewRecord {
  id: string
  decision: ReviewDecision
  notes: string | null
  checks: Partial<ReviewChecks> | null
  createdAt: string
  /** Null for decisions not made by an admin. */
  reviewer: { firstName: string; lastName: string; email: string } | null
}

export interface AssignedNumber {
  id: string
  phone: string
  displayName: string | null
  assignedAt: string | null
}

export interface VendorDetail {
  id: string
  ref: string
  shopName: string
  status: VendorStatus
  signedUpAt: string
  submittedAt: string | null
  account: { email: string; name: string }
  owner: { name: string; phone: string | null }
  market: string | null
  stall: string | null
  description: string | null
  delivery: { fee: number; areas: DeliveryArea[]; slots: DeliverySlot[]; pickupNote: string | null }
  momo: { number: string | null; registeredName: string | null }
  /** Uploaded documents only. */
  documents: VendorDocument[]
  kyc: ChecklistStep[]
  products: { sample: Product[]; inStock: number; uncategorised: number }
  /** Newest first. */
  reviews: ReviewRecord[]
  /** Ticks saved so far in the current review. */
  checks: ReviewChecks
  number: AssignedNumber | null
  banner: ShopBanner
}

interface ApiTenantDetail {
  id: string
  ref: string
  name: string
  status: TenantStatus
  createdAt: string
  submittedAt: string | null
  ownerFullName: string
  ownerPhone: string | null
  market: string | null
  stallLocation: string | null
  description: string | null
  deliveryFee: number
  pickupNote: string | null
  deliveryAreas: DeliveryArea[] | null
  deliverySlots: DeliverySlot[] | null
  momoNumber: string | null
  momoName: string | null
  reviewChecks: Partial<ReviewChecks> | null
  user: { email: string; firstName: string; lastName: string }
  number: ApiNumber | null
  documents: Omit<VendorDocument, 'title'>[]
  kyc: ChecklistStep[]
  products: { sample: Product[]; inStock: number; uncategorised: number }
  reviews: ReviewRecord[]
  banner: ShopBanner
}

const documentTitle = (type: DocumentType) => DOCUMENT_SLOTS.find((slot) => slot.type === type)?.title ?? type

export async function fetchVendorDetail(id: string): Promise<VendorDetail> {
  const t = await api.get<ApiTenantDetail>(`/admin/tenants/${id}`)
  const order = (type: DocumentType) => DOCUMENT_SLOTS.findIndex((slot) => slot.type === type)
  return {
    id: t.id,
    ref: t.ref,
    shopName: t.name,
    status: TENANT_TO_VENDOR_STATUS[t.status],
    signedUpAt: t.createdAt,
    submittedAt: t.submittedAt,
    account: { email: t.user.email, name: `${t.user.firstName} ${t.user.lastName}`.trim() },
    owner: { name: t.ownerFullName, phone: t.ownerPhone },
    market: t.market,
    stall: t.stallLocation,
    description: t.description,
    delivery: {
      fee: t.deliveryFee,
      areas: t.deliveryAreas ?? [],
      slots: t.deliverySlots ?? [],
      pickupNote: t.pickupNote,
    },
    momo: { number: t.momoNumber, registeredName: t.momoName },
    documents: t.documents
      .map((doc) => ({ ...doc, title: documentTitle(doc.type) }))
      .sort((a, b) => order(a.type) - order(b.type)),
    kyc: t.kyc,
    products: t.products,
    reviews: t.reviews,
    checks: { ...NO_CHECKS, ...t.reviewChecks },
    number: t.number
      ? { id: t.number.id, phone: t.number.displayNumber, displayName: t.number.displayName, assignedAt: t.number.assignedAt }
      : null,
    banner: t.banner,
  }
}

export type ProductStock = 'all' | 'in' | 'out'

export interface VendorProductsQuery {
  search: string
  stock: ProductStock
  page: number
  pageSize: number
}

export type VendorProductsPage = ApiPage<Product> & { counts: Record<ProductStock, number> }

/** Every product of a shop, oldest first, a page at a time. */
export const fetchVendorProducts = (id: string, query: VendorProductsQuery): Promise<VendorProductsPage> =>
  api.get<VendorProductsPage>(
    `/admin/tenants/${id}/products${queryString({
      search: query.search.trim(),
      stock: query.stock === 'all' ? undefined : query.stock,
      page: query.page,
      limit: query.pageSize,
    })}`,
  )

/** Streams a KYC file (it needs the token). Each open is written to the audit log. */
export const fetchVendorDocument = (vendorId: string, documentId: string): Promise<Blob> =>
  apiBlob(`/admin/tenants/${vendorId}/documents/${documentId}/file`)

/** Marks a STOCKED shop as taken (→ UNDER_REVIEW). A 409 because it is already in review is fine. */
export async function startReview(id: string): Promise<void> {
  try {
    await api.post(`/admin/tenants/${id}/start-review`)
  } catch (err) {
    if (!isConflict(err)) throw err
  }
}

/**
 * Saves checklist ticks as they change (only while UNDER_REVIEW). The backend takes the
 * ticks as top-level fields, e.g. `{ "momoNameMatches": true }`, not wrapped in `checks`.
 */
export const saveChecks = (id: string, checks: Partial<ReviewChecks>): Promise<unknown> =>
  api.put(`/admin/tenants/${id}/checks`, checks)

export interface ApproveInput {
  /** Omit for the next free number. */
  numberId?: string
  displayName: string
  notes?: string
  /** The ticks as shown; they win over the saved ones. */
  checks?: ReviewChecks
}

/** Assigns the number and makes the shop ACTIVE. All four checks must be saved (or sent). */
export async function approveVendor(id: string, input: ApproveInput): Promise<PoolNumber> {
  const result = await api.post<{ number: ApiNumber }>(`/admin/tenants/${id}/review`, {
    decision: 'APPROVED',
    ...input,
    notes: input.notes || undefined,
  })
  return toPoolNumber(result.number)
}

/** MORE_INFO or REJECTED; the notes are shown to the vendor. */
export const sendBack = (id: string, decision: 'MORE_INFO' | 'REJECTED', notes: string): Promise<unknown> =>
  api.post(`/admin/tenants/${id}/review`, { decision, notes })

/** Read-only for the vendor; buyers are told the shop is closed. The shop keeps its number. */
export const suspendVendor = (id: string, reason: string): Promise<unknown> =>
  api.post(`/admin/tenants/${id}/suspend`, { reason })

/** For a suspended shop: its number starts cooling for 7 days. */
export const releaseVendorNumber = (id: string): Promise<unknown> => api.post(`/admin/tenants/${id}/release`)

/** Back to ACTIVE if it kept its number, otherwise back to the queue for a new one. */
export const reinstateVendor = (id: string): Promise<unknown> => api.post(`/admin/tenants/${id}/reinstate`)

// ---------------------------------------------------------------------------
// Private notes (admins only; vendors never see them)
// ---------------------------------------------------------------------------

export const MAX_NOTE_LENGTH = 2000

export interface VendorNote {
  id: string
  body: string
  createdAt: string
  /** Set once the author has edited it. */
  editedAt: string | null
  author: { id: string; name: string }
  /** Written by the signed-in admin, so they may edit or delete it. */
  mine: boolean
}

/** Newest first. */
export const fetchVendorNotes = (vendorId: string): Promise<VendorNote[]> =>
  api.get<VendorNote[]>(`/admin/tenants/${vendorId}/notes`)

export const addVendorNote = (vendorId: string, body: string): Promise<VendorNote> =>
  api.post<VendorNote>(`/admin/tenants/${vendorId}/notes`, { body })

/** Author only (403 otherwise). */
export const editVendorNote = (vendorId: string, noteId: string, body: string): Promise<VendorNote> =>
  api.patch<VendorNote>(`/admin/tenants/${vendorId}/notes/${noteId}`, { body })

/** Author only (403 otherwise). */
export const deleteVendorNote = (vendorId: string, noteId: string): Promise<void> =>
  api.delete<void>(`/admin/tenants/${vendorId}/notes/${noteId}`)

// ---------------------------------------------------------------------------
// Shop banner review
// ---------------------------------------------------------------------------

/** The upload waiting for approval (not public, so fetched with the token). */
export const fetchPendingBanner = (vendorId: string): Promise<Blob> => apiBlob(`/admin/tenants/${vendorId}/banner/pending`)

/** `pendingAt` is the upload you looked at: a newer upload makes this a 409. */
export const approveBanner = (vendorId: string, pendingAt: string): Promise<ShopBanner> =>
  api.post<ShopBanner>(`/admin/tenants/${vendorId}/banner/approve`, { pendingAt })

/** The reason is shown to the vendor. */
export const rejectBanner = (vendorId: string, pendingAt: string, reason: string): Promise<ShopBanner> =>
  api.post<ShopBanner>(`/admin/tenants/${vendorId}/banner/reject`, { pendingAt, reason })

/** Takes the live banner down; the reason is shown to the vendor. */
export const removeBanner = (vendorId: string, reason: string): Promise<ShopBanner> =>
  api.post<ShopBanner>(`/admin/tenants/${vendorId}/banner/remove`, { reason })
