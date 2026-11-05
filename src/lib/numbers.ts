/** The WhatsApp number pool (GET/POST /admin/numbers…). */
import { api } from './api'
import { TENANT_TO_VENDOR_STATUS, type TenantStatus } from './tenants'
import type { VendorStatus } from './vendors'

export type NumberStatus = 'FREE' | 'ASSIGNED' | 'COOLING'

/** Meta's phone-number quality rating ("UNRATED" covers null and UNKNOWN). */
export type NumberQuality = 'GREEN' | 'YELLOW' | 'RED' | 'UNRATED'

/** Days a released number waits before it can be assigned again. */
export const COOLING_DAYS = 7

export interface PoolNumber {
  id: string
  /** As stored, e.g. "0205960861". Format it for display. */
  phone: string
  /** Meta phone number ID. */
  phoneNumberId: string
  wabaId: string | null
  status: NumberStatus
  quality: NumberQuality
  /** Yellow or red. */
  qualityIssue: boolean
  /** E.g. "TIER_1K"; null when Meta doesn't report one. */
  messagingLimit: string | null
  /** When quality and tier were last fetched from Meta. */
  refreshedAt: string | null
  registeredAt: string
  assignedAt: string | null
  releasedAt: string | null
  vendor: { id: string; shopName: string; status: VendorStatus } | null
  displayName: string | null
}

export interface PoolSummary {
  total: number
  free: number
  assigned: number
  cooling: number
  qualityIssues: number
}

export type PoolFilter = 'all' | 'free' | 'assigned' | 'cooling' | 'quality'

export interface NewNumberInput {
  phoneNumberId: string
  displayNumber: string
  wabaId?: string
  displayName?: string
}

export interface RefreshAllResult {
  total: number
  refreshed: number
  failed: { id: string; displayNumber: string; error: string }[]
}

export interface ApiNumber {
  id: string
  phoneNumberId: string
  displayNumber: string
  wabaId: string | null
  status: NumberStatus
  displayName: string | null
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | null
  messagingLimit: string | null
  qualityIssue?: boolean
  refreshedAt: string | null
  assignedAt: string | null
  releasedAt: string | null
  createdAt: string
  tenant?: { id: string; name: string; status: TenantStatus } | null
}

export function toPoolNumber(n: ApiNumber): PoolNumber {
  const quality = n.qualityRating && n.qualityRating !== 'UNKNOWN' ? n.qualityRating : 'UNRATED'
  return {
    id: n.id,
    phone: n.displayNumber,
    phoneNumberId: n.phoneNumberId,
    wabaId: n.wabaId,
    status: n.status,
    quality,
    qualityIssue: n.qualityIssue ?? (quality === 'YELLOW' || quality === 'RED'),
    messagingLimit: n.messagingLimit,
    refreshedAt: n.refreshedAt,
    registeredAt: n.createdAt,
    assignedAt: n.assignedAt,
    releasedAt: n.releasedAt,
    vendor: n.tenant
      ? { id: n.tenant.id, shopName: n.tenant.name, status: TENANT_TO_VENDOR_STATUS[n.tenant.status] }
      : null,
    displayName: n.displayName,
  }
}

const FILTER_QUERY: Record<PoolFilter, string> = {
  all: '',
  free: '?status=FREE',
  assigned: '?status=ASSIGNED',
  cooling: '?status=COOLING',
  quality: '?quality=issues',
}

/** Oldest first; the list isn't paginated. */
export const fetchNumberPool = (filter: PoolFilter = 'all'): Promise<PoolNumber[]> =>
  api.get<ApiNumber[]>(`/admin/numbers${FILTER_QUERY[filter]}`).then((list) => list.map(toPoolNumber))

export const fetchFreeNumbers = (): Promise<PoolNumber[]> => fetchNumberPool('free')

export const fetchPoolSummary = (): Promise<PoolSummary> => api.get<PoolSummary>('/admin/numbers/summary')

/** The backend checks the number with Meta before saving it. */
export const addNumber = (input: NewNumberInput): Promise<PoolNumber> =>
  api.post<ApiNumber>('/admin/numbers', input).then(toPoolNumber)

/** Releases the number. An open shop is suspended in the same step (a reason is required then). */
export const releaseNumber = (id: string, reason?: string): Promise<{ suspended: boolean }> =>
  api.post<{ suspended: boolean }>(`/admin/numbers/${id}/release`, reason ? { reason } : {})

/** Ends the cooling period early. */
export const freeNumberNow = (id: string): Promise<PoolNumber> =>
  api.post<ApiNumber>(`/admin/numbers/${id}/free`).then(toPoolNumber)

/** Fetches quality and tier from Meta for one number. */
export const refreshNumber = (id: string): Promise<PoolNumber> =>
  api.post<ApiNumber>(`/admin/numbers/${id}/refresh`).then(toPoolNumber)

/** Refreshes every number (about a second each). */
export const refreshAllNumbers = (): Promise<RefreshAllResult> => api.post<RefreshAllResult>('/admin/numbers/refresh')
