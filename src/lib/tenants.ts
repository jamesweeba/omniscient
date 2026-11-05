/** Shops ("tenants") as the backend names them. */
import type { VendorStatus } from './vendors'

/** Status names the backend uses. */
export type TenantStatus = 'PENDING' | 'STOCKED' | 'UNDER_REVIEW' | 'MORE_INFO' | 'REJECTED' | 'ACTIVE' | 'SUSPENDED'

/** Backend status ↔ the app's vendor status. */
export const TENANT_TO_VENDOR_STATUS: Record<TenantStatus, VendorStatus> = {
  PENDING: 'PENDING_NO_PRODUCTS',
  STOCKED: 'READY_FOR_REVIEW',
  UNDER_REVIEW: 'UNDER_REVIEW',
  MORE_INFO: 'MORE_INFO_REQUESTED',
  REJECTED: 'REJECTED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
}

export const VENDOR_TO_TENANT_STATUS = Object.fromEntries(
  Object.entries(TENANT_TO_VENDOR_STATUS).map(([tenant, vendor]) => [vendor, tenant]),
) as Record<VendorStatus, TenantStatus>
