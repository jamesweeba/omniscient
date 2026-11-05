import { parseGhanaPhone } from './phone'

const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR

/** "1 order", "3 orders". */
export const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

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
const weekdayFormat = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short' })
const longDayFormat = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long', day: 'numeric', month: 'long' })
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone }) // yyyy-mm-dd

/** "2026-11-05": the day in Accra. */
export const accraDay = (date: Date | string) => dayKeyFormat.format(new Date(date))

/** "Today", "Yesterday" or "Tomorrow" for a date (ISO, or a yyyy-mm-dd day) near `now`; otherwise null. */
export function relativeDay(date: string, now = new Date()): string | null {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : accraDay(date)
  const offset = (days: number) => accraDay(new Date(now.getTime() + days * DAY))
  return day === offset(0) ? 'Today' : day === offset(-1) ? 'Yesterday' : day === offset(1) ? 'Tomorrow' : null
}

/** "Tuesday 3 November", from an ISO time or a yyyy-mm-dd day. */
export const formatLongDay = (date: string) => longDayFormat.format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00Z` : date))

/** "29 Oct 2026" */
export const formatDate = (iso: string) => dateFormat.format(new Date(iso))

/** "30 Oct" */
export const formatShortDate = (iso: string) => shortDateFormat.format(new Date(iso))

/** "31 Oct, 14:20" */
export const formatDateTime = (iso: string) =>
  `${formatShortDate(iso)}, ${timeFormat.format(new Date(iso))}`

/** "Sun 8 Nov, 14:30" */
export const formatWeekdayDateTime = (iso: string) => `${weekdayFormat.format(new Date(iso))} ${formatDateTime(iso)}`

/** Cedis, always with two decimals: "GH₵ 1,234.50"; negative amounts get a minus sign. */
export const formatCedis = (amount: number) =>
  `${amount < 0 ? '−' : ''}GH₵ ${Math.abs(amount).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Pesewas (how the payout API counts money) as cedis: 123450 → "GH₵ 1,234.50". */
export const cedis = (pesewas: number) => formatCedis(pesewas / 100)

/** "★★★★☆" for a 1–5 rating. */
export const formatStars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating)

/** wa.me chat link for a Ghana number ("024 412 7781" or "+233 …"), optionally with a first message. */
export function whatsAppLink(phone: string, text?: string): string {
  const link = `https://wa.me/${parseGhanaPhone(phone)?.digits ?? phone.replace(/\D/g, '')}`
  return text ? `${link}?text=${encodeURIComponent(text)}` : link
}

/** "Steph D.", from first and last names or a full name ("Stephanie Ama Danso"). */
export function shortName(name: string | { firstName: string; lastName: string }): string {
  const [first, ...rest] = typeof name === 'string' ? name.trim().split(/\s+/) : [name.firstName, name.lastName].filter(Boolean)
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first
}

/** "2 days ago" */
export const formatTimeAgo = (iso: string, now = Date.now()) => `${formatWaiting(iso, now)} ago`

