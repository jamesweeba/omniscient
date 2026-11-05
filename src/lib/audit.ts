/** The admin audit log (append-only; written by the backend with each action). */
import { api, apiDownload, type ApiPage, type Paginated, queryString, toPaginated } from './api'
import type { PeriodQuery } from './orders'

export type AuditAction =
  | 'REVIEW_STARTED'
  | 'CHECKLIST_UPDATED'
  | 'APPROVED'
  | 'MORE_INFO_REQUESTED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'NUMBER_RELEASED'
  | 'REINSTATED'
  | 'NUMBER_ADDED'
  | 'NUMBER_FREED'
  | 'NUMBER_REFRESHED'
  | 'DOCUMENT_VIEWED'
  | 'NOTE_ADDED'
  | 'NOTE_EDITED'
  | 'NOTE_DELETED'
  | 'BANNER_APPROVED'
  | 'BANNER_REJECTED'
  | 'BANNER_REMOVED'
  | 'PAYOUT_RETRIED'
  | 'PAYOUT_SENT'
  | 'PAYOUTS_PAUSED'
  | 'PAYOUTS_RESUMED'
  | 'ORDER_RELEASED'

export interface AuditEntry {
  id: string
  createdAt: string
  action: AuditAction
  actionLabel: string
  actor: { id: string; name: string }
  /** `exists` is false once the shop is deleted (the name is a copy). */
  tenant: { id: string; name: string; ref: string | null; exists: boolean } | null
  number: { id: string; displayNumber: string } | null
  details: string
  metadata: Record<string, unknown> | null
}

export interface AuditAdmin {
  id: string
  name: string
  /** Null for someone who is no longer a super admin. */
  email: string | null
  current: boolean
}

export interface AuditQuery extends PeriodQuery {
  action?: AuditAction[]
  adminId?: string
  /** Shop name or ref, WhatsApp number, admin name, or text in details. */
  search?: string
}

const filterParams = (query: AuditQuery) => ({
  search: query.search,
  action: query.action?.join(','),
  adminId: query.adminId,
  ...(query.from || query.to ? { from: query.from, to: query.to } : { period: query.period }),
})

export const fetchAuditLog = (query: AuditQuery & { page: number; pageSize: number }): Promise<Paginated<AuditEntry>> =>
  api
    .get<ApiPage<AuditEntry>>(`/admin/audit-log${queryString({ ...filterParams(query), page: query.page, limit: query.pageSize })}`)
    .then((r) => toPaginated(r))

export const fetchAuditAdmins = (): Promise<AuditAdmin[]> => api.get<AuditAdmin[]>('/admin/audit-log/admins')

/** Every matching entry (up to 10,000) as CSV, with the server's file name. */
export const exportAuditLog = (query: AuditQuery) => apiDownload(`/admin/audit-log/export${queryString(filterParams(query))}`)
