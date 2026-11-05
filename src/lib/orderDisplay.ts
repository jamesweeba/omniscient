import type { BadgeTone } from '@/components/Badge/Badge'
import { formatPrice, whatsAppLink } from './format'
import type { Fulfillment, Order, OrderPeriod, OrderStatus, PaymentMethod, PeriodQuery, ShopOrderTab } from './orders'
import { formatPhone } from './phone'

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
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

/**
 * The delivery details a vendor sends their rider on WhatsApp: buyer, where to go (with a
 * map link once the buyer has shared their pin), what to collect, and what's in the bag.
 */
export function riderMessage(order: Order, shopName: string | null): string {
  const phone = order.contactPhone ?? (isHiddenBuyer(order.buyerPhone) ? null : order.buyerPhone)
  const buyer = [order.customerName, phone && formatPhone(phone, 'local')].filter(Boolean).join(', ')
  const where = order.deliveryAddress ?? [order.deliveryArea, order.landmark].filter(Boolean).join(', ')
  const map = mapLink(order)
  const items = order.items.map((item) => `• ${item.quantity} × ${item.productName}`)

  const lines: (string | null)[] = [
    `🛵 *Delivery${shopName ? ` for ${shopName}` : ''}*`,
    `Order: *${order.orderNumber}*`,
    '',
    buyer ? `👤 Buyer: ${buyer}` : null,
    where ? `📍 Area: ${where}` : null,
    map
      ? `🗺️ Map: ${map}${order.locationName ? ` (${order.locationName})` : ''}`
      : '🗺️ Map: the buyer hasn’t shared their location pin yet',
    order.deliverySlot ? `🕒 When: ${order.deliverySlot}` : null,
    '',
    payment(order),
    ...(items.length ? ['', '📦 Items:', ...items] : []),
  ]
  return lines.filter((line) => line !== null).join('\n')
}

/** What the rider must collect. Only cash orders, or orders not paid yet, need anything. */
function payment(order: Order): string {
  if (order.paymentMethod === 'COD') return `💵 Collect *${formatPrice(order.totalAmount)}* in cash`
  if (order.status === 'PENDING' || order.status === 'AWAITING_PAYMENT') {
    return `⚠️ Not paid yet (${formatPrice(order.totalAmount)}): check with the shop before handing it over`
  }
  return '✅ Already paid: collect nothing'
}

/** A WhatsApp link that opens a chat with `phone`, with `text` typed in and ready to send. */
export const whatsAppMessageLink = (phone: string, text: string) => `${whatsAppLink(phone)}?text=${encodeURIComponent(text)}`
