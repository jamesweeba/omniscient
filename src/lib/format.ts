import { parseGhanaPhone } from './phone'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

/** Whole days since `iso`. */
export function daysSince(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / DAY)
}

/** "Under an hour", "6 hours", "5 days". */
function formatDuration(ms: number, round: (n: number) => number): string {
  const elapsed = Math.max(0, ms)
  if (elapsed < HOUR) return 'Under an hour'
  if (elapsed < DAY) return plural(round(elapsed / HOUR), 'hour')
  return plural(round(elapsed / DAY), 'day')
}

/** Time since `iso`, e.g. "6 hours" or "5 days". */
export function formatWaiting(iso: string, now = Date.now()): string {
  return formatDuration(now - new Date(iso).getTime(), Math.floor)
}

// Always Ghana time, whatever the viewer's device is set to.
const timeZone = 'Africa/Accra'
const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' })
const shortDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' })

/** "29 Oct 2026" */
export const formatDate = (iso: string) => dateFormat.format(new Date(iso))

/** "30 Oct" */
export const formatShortDate = (iso: string) => shortDateFormat.format(new Date(iso))

/** "31 Oct, 14:20" */
export const formatDateTime = (iso: string) =>
  `${formatShortDate(iso)}, ${timeFormat.format(new Date(iso))}`

/** "GH₵ 15" */
export const formatCedis = (amount: number) => `GH₵ ${amount.toLocaleString('en-GH')}`

/** wa.me chat link for a Ghana number ("024 412 7781" or "+233 …"). */
export function whatsAppLink(phone: string): string {
  return `https://wa.me/${parseGhanaPhone(phone)?.digits ?? phone.replace(/\D/g, '')}`
}

/** "Steph D." */
export function shortName({ firstName, lastName }: { firstName: string; lastName: string }): string {
  return lastName ? `${firstName} ${lastName[0]}.` : firstName
}

/** "2 days ago" */
export const formatTimeAgo = (iso: string, now = Date.now()) => `${formatWaiting(iso, now)} ago`

/** Vendor-app prices: always two decimals, e.g. "GH₵ 20.00". */
export const formatPrice = (amount: number) =>
  `GH₵ ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
