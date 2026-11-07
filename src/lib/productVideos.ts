import { api, apiBlob, type ApiPage } from './api'

/** A product's video (see VIDEO_SPEC.md in the API repo). */

export type VideoStatus = 'NONE' | 'PROCESSING' | 'PENDING' | 'REJECTED' | 'FAILED'

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

// Vendor

export const fetchProductVideo = (productId: string) => api.get<ProductVideo>(`/products/${productId}/video`)

export function uploadProductVideo(productId: string, file: File): Promise<ProductVideo> {
  const form = new FormData()
  form.append('file', file, file.name || 'video.mp4')
  return api.post<ProductVideo>(`/products/${productId}/video`, form)
}

export const cancelProductVideo = (productId: string) => api.delete<ProductVideo>(`/products/${productId}/video/pending`)

export const removeProductVideo = (productId: string) => api.delete<ProductVideo>(`/products/${productId}/video`)

// Admin

export interface WaitingVideo {
  productId: string
  productName: string
  tenant: { id: string; name: string }
  video: ProductVideo
}

export const fetchWaitingVideos = (page: number, pageSize: number) => api.get<ApiPage<WaitingVideo>>(`/admin/videos?page=${page}&limit=${pageSize}`)

export const approveProductVideo = (productId: string, uploadedAt: string) =>
  api.post<ProductVideo>(`/admin/products/${productId}/video/approve`, { uploadedAt })

export const rejectProductVideo = (productId: string, uploadedAt: string, reason: string) =>
  api.post<ProductVideo>(`/admin/products/${productId}/video/reject`, { uploadedAt, reason })

export const removeLiveProductVideo = (productId: string, reason: string) => api.post<ProductVideo>(`/admin/products/${productId}/video/remove`, { reason })

export const formatSeconds = (seconds: number | null) => (seconds === null ? '' : `${seconds}s`)
