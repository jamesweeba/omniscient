import { api, apiBlob, type ApiPage } from './api'

/** A product's video (see VIDEO_SPEC.md in the API repo). */
type VideoStatus = 'NONE' | 'PROCESSING' | 'PENDING' | 'REJECTED' | 'FAILED'

export interface ProductVideo {
  /** The latest upload: NONE, PROCESSING (being converted), PENDING (waiting for an admin), REJECTED or FAILED. */
  status: VideoStatus
  /** The approved video buyers can watch. */
  live: { approvedAt: string; seconds: number | null; url: string; posterUrl: string } | null
  /** A converted upload waiting for an admin. */
  pending: { uploadedAt: string; seconds: number | null; trimmed: boolean; url: string; posterUrl: string } | null
  /** Why the upload was turned down or couldn't be converted. */
  message: string | null
}

/** The most a vendor may upload, before the server compresses it. */
export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024
export const MAX_VIDEO_SECONDS = 30

/** File URLs from the API are full paths (/api/v1/...); apiBlob wants them without the /api/v1 prefix. */
const relative = (url: string) => url.replace(/^\/api\/v1/, '')

export const fetchVideoFile = (url: string) => apiBlob(relative(url))

// Vendor. `measure`: a measure's code for that measure's video; '' (the default) for the whole product.

const measureQuery = (measure: string) => (measure ? `?measure=${encodeURIComponent(measure)}` : '')

/** Every video of a product: the whole product's and each measure's. */
export interface ProductVideos {
  product: ProductVideo
  measures: { code: string; label: string; video: ProductVideo }[]
}

export const fetchProductVideos = (productId: string) => api.get<ProductVideos>(`/products/${productId}/videos`)

export function uploadProductVideo(productId: string, file: File, measure = ''): Promise<ProductVideo> {
  const form = new FormData()
  form.append('file', file, file.name || 'video.mp4')
  return api.post<ProductVideo>(`/products/${productId}/video${measureQuery(measure)}`, form)
}

export const cancelProductVideo = (productId: string, measure = '') => api.delete<ProductVideo>(`/products/${productId}/video/pending${measureQuery(measure)}`)

export const removeProductVideo = (productId: string, measure = '') => api.delete<ProductVideo>(`/products/${productId}/video${measureQuery(measure)}`)

// Admin

export interface WaitingVideo {
  productId: string
  productName: string
  /** Null: a video of the whole product. */
  measure: { code: string; label: string } | null
  tenant: { id: string; name: string }
  video: ProductVideo
}

export const fetchWaitingVideos = (page: number, pageSize: number) => api.get<ApiPage<WaitingVideo>>(`/admin/videos?page=${page}&limit=${pageSize}`)

export const approveProductVideo = (productId: string, uploadedAt: string, measure = '') =>
  api.post<ProductVideo>(`/admin/products/${productId}/video/approve${measureQuery(measure)}`, { uploadedAt })

export const rejectProductVideo = (productId: string, uploadedAt: string, reason: string, measure = '') =>
  api.post<ProductVideo>(`/admin/products/${productId}/video/reject${measureQuery(measure)}`, { uploadedAt, reason })
