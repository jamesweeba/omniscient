/**
 * The vendor onboarding API (see VENDOR_ONBOARDING_API.md). Every call acts on the logged-in
 * vendor's own shop; the backend takes the vendor from the access token.
 */
import { api, apiBlob, ApiError, type ApiPage, apiRequest, apiUrl, isNotFound } from './api'
import type { TenantStatus } from './tenants'
import type { ReviewDecision } from './vendors'

export type { TenantStatus } from './tenants'

// ---------------------------------------------------------------------------
// Shop (tenant)
// ---------------------------------------------------------------------------

export interface DeliveryArea {
  id: string
  title: string
}

export interface DeliverySlot {
  id: string
  title: string
  description?: string
}

export interface Shop {
  id: string
  name: string
  slug: string
  status: TenantStatus
  submittedAt: string | null
  whatsappNumber: string | null
  ownerFullName: string
  ownerPhone: string
  market: string | null
  stallLocation: string | null
  momoNumber: string | null
  momoName: string | null
  description: string | null
  deliveryFee: number
  pickupNote: string | null
  deliveryAreas: DeliveryArea[] | null
  deliverySlots: DeliverySlot[] | null
  createdAt: string
  modifiedAt: string
}

/** The fields a vendor can set. `name`, `ownerFullName` and `ownerPhone` are required to create. */
export interface ShopInput {
  name: string
  ownerFullName: string
  ownerPhone: string
  market?: string
  stallLocation?: string
  momoNumber?: string
  momoName?: string
  description?: string
  deliveryFee?: number
  pickupNote?: string
  deliveryAreas?: DeliveryArea[]
  deliverySlots?: DeliverySlot[]
}

export type StepKey =
  | 'shop'
  | 'ownerDetails'
  | 'momoPayout'
  | 'ghanaCardFront'
  | 'ghanaCardBack'
  | 'stallPhoto'
  | 'products'
  | 'approved'

export interface ShopStatus {
  status: TenantStatus
  canResubmit: boolean
  steps: ChecklistStep<StepKey>[]
  latestReview: {
    decision: ReviewDecision
    notes: string | null
    createdAt: string
  } | null
  /** The WhatsApp number buyers message, once approved. */
  number: { displayNumber: string; displayName: string; assignedAt: string } | null
}

/** The onboarding dashboard's data, or null when the vendor hasn't created a shop yet. */
export async function fetchShopStatus(): Promise<ShopStatus | null> {
  try {
    return await api.get<ShopStatus>('/tenants/status')
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

export const fetchShop = () => api.get<Shop>('/tenants')

export const createShop = (input: ShopInput) => api.post<Shop>('/tenants', input)

/** Partial update: send only the fields that changed. */
export const updateShop = (changes: Partial<ShopInput>) => api.put<Shop>('/tenants', changes)

/** Sends the shop back for review after MORE_INFO or REJECTED. */
export const resubmitShop = () => api.post<Shop>('/tenants/resubmit')

/** KYC fields and documents are locked while the shop is being reviewed or is live. */
export const isKycLocked = (status: TenantStatus) => status === 'UNDER_REVIEW' || status === 'ACTIVE'

/** A suspended shop is read-only. */
export const isReadOnly = (status: TenantStatus) => status === 'SUSPENDED'

// ---------------------------------------------------------------------------
// KYC documents
// ---------------------------------------------------------------------------

export type DocumentType = 'GHANA_CARD_FRONT' | 'GHANA_CARD_BACK' | 'STALL_PHOTO' | 'BUSINESS_REG'

/** One item of a shop's setup checklist. */
export interface ChecklistStep<K extends string = string> {
  key: K
  label: string
  done: boolean
}

export interface ShopDocument {
  id: string
  type: DocumentType
  fileName: string
  mimeType: string
  size: number
  uploadedAt: string
}

export const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
/** The largest file the API accepts (documents, photos, banners, sheets): 5 MB. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export const fetchDocuments = () => api.get<ShopDocument[]>('/tenants/documents')

/** Uploads (or replaces) the document of one type. */
export function uploadDocument(type: DocumentType, file: Blob, fileName: string): Promise<ShopDocument> {
  const form = new FormData()
  form.append('type', type)
  form.append('file', file, fileName)
  return api.post<ShopDocument>('/tenants/documents', form)
}

export const fetchDocumentFile = (id: string) => apiBlob(`/tenants/documents/${id}/file`)

// ---------------------------------------------------------------------------
// Categories and products
// ---------------------------------------------------------------------------

export interface Category {
  id: string
  title: string
  description: string | null
  sortOrder: number
  productCount: number
}

export interface Measure {
  /** Lowercase letters, digits and `_`; unique within the product. */
  code: string
  /** At most 15 characters. */
  label: string
  price: number
  description?: string | null
}

export interface Product {
  id: string
  name: string
  categoryId: string
  category: { id: string; title: string } | null
  price: number
  /** An emoji shown before the name in WhatsApp text lists. Not a photo: see `photoUrl`. */
  image: string | null
  /** The uploaded photo's path on the API (public), or null. Use `productPhotoSrc`. */
  photoUrl: string | null
  inStock: boolean
  note: string | null
  measures: Measure[]
}

export interface ProductInput {
  name: string
  categoryId: string
  price?: number
  inStock?: boolean
  note?: string
  measures?: Measure[]
}

export const MAX_MEASURES = 10
export const MAX_MEASURE_LABEL = 15
/** The API caps product pages at 5. */
export const PRODUCTS_PER_PAGE = 5

export const fetchCategories = () => api.get<Category[]>('/categories')

export function fetchProducts(page: number, search: string): Promise<ApiPage<Product>> {
  const params = new URLSearchParams({ page: String(page), limit: String(PRODUCTS_PER_PAGE) })
  if (search) params.set('search', search)
  return api.get<ApiPage<Product>>(`/products?${params}`)
}

export const fetchProduct = (id: string) => api.get<Product>(`/products/${id}`)

export const createProduct = (input: ProductInput) => api.post<Product>('/products', input)

/** Sending `measures` replaces the whole list. */
export const updateProduct = (id: string, changes: Partial<ProductInput>) =>
  api.patch<Product>(`/products/${id}`, changes)

export const deleteProduct = (id: string) => api.delete<unknown>(`/products/${id}`)

/** Uploads (or replaces) a product's photo. JPEG, PNG or WebP, up to 5 MB. */
export function uploadProductPhoto(id: string, photo: Blob, fileName: string): Promise<{ photoUrl: string }> {
  const form = new FormData()
  form.append('file', photo, fileName)
  return api.post<{ photoUrl: string }>(`/products/${id}/photo`, form)
}

export const removeProductPhoto = (id: string) => api.delete<{ photoUrl: null }>(`/products/${id}/photo`)

/** The address of a product's photo, for an <img>. Photos are public, so no token is needed. */
export const productPhotoSrc = (product: Pick<Product, 'photoUrl'>) => (product.photoUrl ? apiUrl(product.photoUrl) : null)

// ---------------------------------------------------------------------------
// Shop banner (shown to buyers beside the shop name on the order form once an admin approves it)
// ---------------------------------------------------------------------------

export interface ShopBanner {
  /** The approved banner's path on the API (public), or null. Use `apiUrl` for an <img>. */
  url: string | null
  /** When the upload waiting for approval was made; null when nothing is waiting. */
  pendingAt: string | null
  /** Why an admin turned down (or took down) the last banner; cleared by a new upload. */
  rejectedReason: string | null
}

/** Buyers see a square from the centre, so each side must be at least this many pixels. */
export const MIN_BANNER_SIDE = 300

export const fetchShopBanner = () => api.get<ShopBanner>('/tenants/banner')

/** Uploads a banner for approval (replaces one already waiting). JPEG, PNG or WebP, ≥ 300 px each side. */
export function uploadShopBanner(image: Blob, fileName: string): Promise<ShopBanner> {
  const form = new FormData()
  form.append('file', image, fileName)
  return api.post<ShopBanner>('/tenants/banner', form)
}

/** The upload waiting for approval (needs the token, so it is fetched as a blob). */
export const fetchPendingShopBanner = () => apiBlob('/tenants/banner/pending')

export const cancelPendingShopBanner = () => api.delete<ShopBanner>('/tenants/banner/pending')

/** Takes the approved banner down; buyers stop seeing it at once. */
export const removeShopBanner = () => api.delete<ShopBanner>('/tenants/banner')

// ---------------------------------------------------------------------------
// Excel bulk upload
// ---------------------------------------------------------------------------

export const downloadProductTemplate = () => apiBlob('/products/upload/template')

export interface UploadResult {
  totalRows: number
  created: number
  products: { row: number; name: string; categoryId: string }[]
}

/** Thrown when some rows are invalid; nothing was imported. */
export class SheetRowsError extends Error {
  readonly totalRows: number
  readonly errors: { row: number; message: string }[]

  constructor(message: string, totalRows: number, errors: { row: number; message: string }[]) {
    super(message)
    this.name = 'SheetRowsError'
    this.totalRows = totalRows
    this.errors = errors
  }
}

/** Imports an .xlsx/.xls file. All or nothing: any bad row and nothing is imported. */
export async function uploadProducts(file: File, categoryId?: string): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  if (categoryId) form.append('categoryId', categoryId)
  try {
    return await apiRequest<UploadResult>('/products/upload', { method: 'POST', body: form })
  } catch (err) {
    const body = err instanceof ApiError ? (err.body as Partial<SheetRowsError> | null) : null
    if (err instanceof ApiError && Array.isArray(body?.errors)) {
      throw new SheetRowsError(err.message, body.totalRows ?? 0, body.errors)
    }
    throw err
  }
}
