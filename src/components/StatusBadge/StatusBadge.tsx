import { Badge } from '@/components/Badge/Badge'
import { VENDOR_STATUS } from '@/lib/vendorStatus'
import type { VendorStatus } from '@/lib/vendors'

export function StatusBadge({ status }: { status: VendorStatus }) {
  const { label, tone } = VENDOR_STATUS[status]
  return <Badge tone={tone}>{label}</Badge>
}
