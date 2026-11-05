/** Orders: the admin's read-only views and the vendor's own orders. */
import { api, type ApiPage, type Paginated, queryString, toPaginated } from './api'
import { TENANT_TO_VENDOR_STATUS, type TenantStatus } from './tenants'
import type { VendorStatus } from './vendors'

export type OrderStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'

export type PaymentMethod = 'MOMO' | 'CARD' | 'COD'

export type Fulfillment = 'DELIVERY' | 'PICKUP'

export type OrderPeriod = 'today' | '7d' | '30d' | '90d' | 'all'

/** A preset period, or whole days `from`–`to` (YYYY-MM-DD, inclusive), which wins over it. */
export interface PeriodQuery {
  period: OrderPeriod
  from?: string
  to?: string
}

export interface OrderItem {
  id: string
  productId?: string | null
  productName: string
  measureCode: string | null
  unitPrice: number
  quantity: number
  totalPrice: number
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
  updatedAt?: string
  /** May be a hidden id such as "GH.989894404158856": don't format it as a phone. */
  buyerPhone: string
  customerName: string | null
  contactPhone: string | null
  totalAmount: number
  deliveryFee: number
  paymentMethod: PaymentMethod | null
  paymentPhone: string | null
  momoNetwork?: string | null
  fulfillment: Fulfillment | null
  deliveryArea: string | null
  landmark: string | null
  deliveryAddress: string | null
  deliverySlot: string | null
  locationLatitude: number | null
  locationLongitude: number | null
  locationName: string | null
  locationAddress?: string | null
  riderName: string | null
  riderPhone: string | null
  /** When the buyer tapped "I got my order" on WhatsApp; null if they haven't. */
  deliveryConfirmedAt?: string | null
  /** The buyer's 1-5 rating from WhatsApp, after confirming delivery. */
  buyerRating?: number | null
  ratedAt?: string | null
  /** When the Paystack MoMo prompt went out. Until Paystack confirms, only Paystack can mark the order paid. */
  paymentRequestedAt?: string | null
  /** When Paystack confirmed the buyer paid MarketiX (MoMo or card orders). */
  paystackPaidAt?: string | null
  /** Admin order detail only: what the order did to the vendor's balance (pesewas), once recorded. */
  settlement?: { type: 'ORDER_EARNING' | 'CASH_COMMISSION'; amount: number; createdAt: string } | null
  notes: string | null
  items: OrderItem[]
}

export interface OrderShop {
  id: string
  ref: string
  name: string
  market: string | null
  status: VendorStatus
  whatsAppNumber: string | null
}

interface ApiShop {
  id: string
  ref: string
  name: string
  market: string | null
  status: TenantStatus
  whatsappNumber?: string | null
}

const toShop = (s: ApiShop): OrderShop => ({
  id: s.id,
  ref: s.ref,
  name: s.name,
  market: s.market,
  status: TENANT_TO_VENDOR_STATUS[s.status],
  whatsAppNumber: s.whatsappNumber ?? null,
})

/** Placed orders only (paid or later), so abandoned MoMo prompts don't count. */
export interface OrderSummary {
  orders: number
  open: number
  /** Delivered and completed orders, including delivery fees, in cedis. */
  deliveredSales: number
  buyers: number
}

const periodParams = ({ period, from, to }: PeriodQuery) => (from || to ? { from, to } : { period })

// ---------------------------------------------------------------------------
// Admin: overview (one row per shop)
// ---------------------------------------------------------------------------

export type OrderShopSort = 'orders' | 'sales' | 'recent'

export interface OrderShopRow {
  shop: OrderShop
  orders: number
  cancelled: number
  open: number
  deliveredSales: number
  lastOrderAt: string | null
}

export interface OrderOverviewQuery extends PeriodQuery {
  search?: string
  sort: OrderShopSort
  page: number
  pageSize: number
}

export async function fetchOrderOverview(query: OrderOverviewQuery): Promise<Paginated<OrderShopRow> & { summary: OrderSummary }> {
  type Row = ApiShop & Omit<OrderShopRow, 'shop'>
  const result = await api.get<ApiPage<Row> & { summary: OrderSummary }>(
    `/admin/orders/overview${queryString({
      ...periodParams(query),
      search: query.search,
      sort: query.sort,
      page: query.page,
      limit: query.pageSize,
    })}`,
  )
  return {
    summary: result.summary,
    ...toPaginated(result, (row) => ({
      shop: toShop(row),
      orders: row.orders,
      cancelled: row.cancelled,
      open: row.open,
      deliveredSales: row.deliveredSales,
      lastOrderAt: row.lastOrderAt,
    })),
  }
}

// ---------------------------------------------------------------------------
// Admin: one shop's orders, and one order
// ---------------------------------------------------------------------------

export type ShopOrderTab = 'placed' | 'open' | 'delivered' | 'cancelled' | 'unpaid' | 'all'

export interface OrderListItem {
  id: string
  orderNumber: string
  status: OrderStatus
  customerName: string | null
  buyerPhone: string
  totalAmount: number
  deliveryFee: number
  paymentMethod: PaymentMethod | null
  fulfillment: Fulfillment | null
  deliveryArea: string | null
  itemCount: number
  createdAt: string
}

export interface ShopOrdersQuery extends PeriodQuery {
  tab: ShopOrderTab
  search?: string
  page: number
  pageSize: number
}

export interface ShopOrders extends Paginated<OrderListItem> {
  shop: OrderShop
  summary: OrderSummary
  counts: Record<ShopOrderTab, number>
}

export async function fetchShopOrders(shopId: string, query: ShopOrdersQuery): Promise<ShopOrders> {
  const result = await api.get<ApiPage<OrderListItem> & { shop: ApiShop; summary: OrderSummary; counts: Record<ShopOrderTab, number> }>(
    `/admin/vendors/${shopId}/orders${queryString({
      tab: query.tab,
      ...periodParams(query),
      search: query.search,
      page: query.page,
      limit: query.pageSize,
    })}`,
  )
  return { shop: toShop(result.shop), summary: result.summary, counts: result.counts, ...toPaginated(result) }
}

export async function fetchAdminOrder(id: string): Promise<Order & { shop: OrderShop }> {
  const { tenant, ...order } = await api.get<Order & { tenant: ApiShop }>(`/admin/orders/${id}`)
  return { ...order, shop: toShop(tenant) }
}

// ---------------------------------------------------------------------------
// Vendor: their own orders
// ---------------------------------------------------------------------------

export interface MyOrdersQuery {
  status?: OrderStatus
  search?: string
  page: number
  pageSize: number
}

export const fetchMyOrders = (query: MyOrdersQuery): Promise<Paginated<Order>> =>
  api
    .get<ApiPage<Order>>(
      `/orders${queryString({ status: query.status, search: query.search, page: query.page, limit: query.pageSize })}`,
    )
    .then((result) => toPaginated(result))

export const fetchMyOrder = (id: string): Promise<Order> => api.get<Order>(`/orders/${id}`)

export interface StatusChange {
  status: OrderStatus
  riderName?: string
  riderPhone?: string
  notes?: string
}

/** The buyer gets a WhatsApp message on PROCESSING, OUT_FOR_DELIVERY and DELIVERED. */
export const updateOrderStatus = (id: string, change: StatusChange): Promise<Order> =>
  api.patch<Order>(`/orders/${id}/status`, change)

export const deleteOrder = (id: string): Promise<unknown> => api.delete(`/orders/${id}`)

export interface NewOrderInput {
  buyerPhone: string
  items: { productName: string; unitPrice: number; quantity: number; productId?: string; measureCode?: string }[]
  paymentMethod?: PaymentMethod
  fulfillment?: Fulfillment
  deliveryAddress?: string
  deliveryFee?: number
  notes?: string
  status?: OrderStatus
}

/** A phone order the vendor types in; the server works out the totals. */
export const createOrder = (input: NewOrderInput): Promise<Order> => api.post<Order>('/orders', input)

/** Sends the WhatsApp ordering form to a phone (only for ACTIVE shops). */
export const sendOrderForm = (toPhone: string): Promise<unknown> => api.post('/flow/send', { toPhone })
