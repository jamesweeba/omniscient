import { type StatusDisplay } from '@/components/Badge/Badge'
import { whatsAppLink } from './format'
import type { Fulfillment, Order, OrderPeriod, OrderStatus, PaymentMethod, PeriodQuery, ShopOrderTab } from './orders'
import { formatPhone } from './phone'

export const ORDER_STATUS: Record<OrderStatus, StatusDisplay> = {
  PENDING: { label: 'Pending', tone: 'neutral' },
  AWAITING_PAYMENT: { label: 'Waiting for MoMo', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'info' },
  PROCESSING: { label: 'Packed', tone: 'info' },
  OUT_FOR_DELIVERY: { label: 'On the way', tone: 'warning' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
}

/** In flow order. */
export const ORDER_STATUSES = Object.keys(ORDER_STATUS) as OrderStatus[]

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  MOMO: 'Mobile Money',
  CARD: 'Card',
  COD: 'Cash on delivery',
}

export const FULFILLMENT: Record<Fulfillment, string> = { DELIVERY: 'Delivery', PICKUP: 'Pickup' }

export const SHOP_ORDER_TABS: { key: ShopOrderTab; label: string }[] = [
  { key: 'placed', label: 'Placed' },
  { key: 'open', label: 'Open' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'all', label: 'All' },
]

export const ORDER_PERIODS: { value: OrderPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

export const DEFAULT_PERIOD: OrderPeriod = '30d'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Reads `period`, `from` and `to` from the URL. Dates win over the preset. */
export function periodParam(params: URLSearchParams): PeriodQuery {
  const period = ORDER_PERIODS.find((o) => o.value === params.get('period'))?.value ?? DEFAULT_PERIOD
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  return { period, from: DATE.test(from) ? from : undefined, to: DATE.test(to) ? to : undefined }
}

/** The period's params for a link, leaving out defaults. */
export function periodLinkParams({ period, from, to }: PeriodQuery): Record<string, string> {
  if (from || to) return Object.fromEntries(Object.entries({ from, to }).filter(([, v]) => v)) as Record<string, string>
  return period === DEFAULT_PERIOD ? {} : { period }
}

/** Google Maps link for a shared pin, or null. */
export function mapLink(order: Pick<Order, 'locationLatitude' | 'locationLongitude'>): string | null {
  const { locationLatitude: lat, locationLongitude: lng } = order
  return lat != null && lng != null ? `https://maps.google.com/?q=${lat},${lng}` : null
}

/** Buyers who hide their number come through as an id such as "GH.989894404158856". */
export const isHiddenBuyer = (phone: string) => !/^\+?\d[\d\s]*$/.test(phone)

export const whatsAppMessageLink = (phone: string, text: string) => `${whatsAppLink(phone)}?text=${encodeURIComponent(text)}`

/** What the items cost, before delivery. */
export const orderSubtotal = (order: { items: { totalPrice: number }[] }) => order.items.reduce((sum, item) => sum + item.totalPrice, 0)

/** Where to deliver: the address, or the area and landmark the buyer gave. Empty when there's neither. */
export const deliveryPlace = (
  order: { deliveryAddress: string | null; deliveryArea: string | null; landmark: string | null },
  separator = ' — ',
) => order.deliveryAddress ?? [order.deliveryArea, order.landmark].filter(Boolean).join(separator)

/** "Kofi · 024 400 0000" */
export const riderText = (order: { riderName: string | null; riderPhone: string | null }, style: 'international' | 'local' = 'local') =>
  [order.riderName, order.riderPhone && formatPhone(order.riderPhone, style)].filter(Boolean).join(' · ')
