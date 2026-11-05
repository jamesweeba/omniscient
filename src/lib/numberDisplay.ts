import { type StatusDisplay } from '@/components/Badge/Badge'
import type { NumberQuality, NumberStatus } from './numbers'

export const NUMBER_STATUS: Record<NumberStatus, StatusDisplay> = {
  FREE: { label: 'Free', tone: 'success' },
  ASSIGNED: { label: 'Assigned', tone: 'info' },
  COOLING: { label: 'Cooling', tone: 'neutral' },
}

export const NUMBER_QUALITY: Record<NumberQuality, string> = {
  GREEN: 'Green',
  YELLOW: 'Yellow',
  RED: 'Red',
  UNRATED: 'Unrated',
}

const TIERS: Record<string, string> = {
  TIER_250: '250 / day',
  TIER_1K: '1K / day',
  TIER_10K: '10K / day',
  TIER_100K: '100K / day',
  TIER_UNLIMITED: 'Unlimited',
}

/** "TIER_1K" → "1K / day"; "—" when Meta reports no tier. */
export function formatMessagingLimit(tier: string | null): string {
  if (!tier) return '—'
  return TIERS[tier] ?? tier.replace(/^TIER_/, '')
}

/** "1083 … 4421" */
export function maskPhoneNumberId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 4)} … ${id.slice(-4)}` : id
}
