import { useOutletContext } from 'react-router'
import type { ShopStatus } from '@/lib/vendorPortal'

export interface VendorContext {
  /** The shop's onboarding status, or null if the vendor hasn't created a shop yet. */
  shop: ShopStatus | null
  /** Fetch the status again (it also refreshes on its own after every change). */
  refresh: () => void
}

/** Shared vendor state for pages under the vendor layout. */
export function useVendorPortal(): VendorContext {
  return useOutletContext<VendorContext>()
}
