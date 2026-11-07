import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { BackLink } from '@/components/BackLink/BackLink'
import { SearchField } from '@/components/FilterControls/FilterControls'
import { PeriodFilter } from '@/components/FilterControls/PeriodFilter'
import { FilterTabs } from '@/components/FilterTabs/FilterTabs'
import { Pagination } from '@/components/Pagination/Pagination'
import { StatusBadge } from '@/components/StatusBadge/StatusBadge'
import { useAsync } from '@/hooks/useAsync'
import { usePageTitle } from '@/hooks/usePageTitle'
import { pageParam, useSearchParamInput, useUrlParams } from '@/hooks/useUrlState'
import { periodLinkParams, periodParam, SHOP_ORDER_TABS } from '@/lib/orderDisplay'
import { fetchShopOrders } from '@/lib/orders'
import { formatPhone } from '@/lib/phone'
import page from '@/styles/page.module.css'
import table from '@/styles/table.module.css'
import { OrderSummaryTiles } from '../Orders/OrderSummaryTiles'
import { OrdersTable } from './OrdersTable'
import styles from './VendorOrders.module.css'

const PAGE_SIZE = 20
const DEFAULT_TAB = SHOP_ORDER_TABS[0]

/** Route entry: remounts the page (and its search box) when the shop changes. */
export function VendorOrdersPage() {
  const { vendorId = '' } = useParams()
  return <VendorOrders key={vendorId} vendorId={vendorId} />
}

function VendorOrders({ vendorId }: { vendorId: string }) {
  const [params, updateParams] = useUrlParams()
  const [searchInput, setSearchInput, search] = useSearchParamInput(params, updateParams)
  const period = periodParam(params)
  const tab = SHOP_ORDER_TABS.find((t) => t.key === params.get('tab')) ?? DEFAULT_TAB
  const pageNumber = pageParam(params)

  const { period: preset, from, to } = period
  const tabKey = tab.key
  const load = useCallback(
    () =>
      fetchShopOrders(vendorId, { tab: tabKey, period: preset, from, to, search: search || undefined, page: pageNumber, pageSize: PAGE_SIZE }),
    [vendorId, tabKey, preset, from, to, search, pageNumber],
  )
  const orders = useAsync(load)
  const data = orders.status === 'success' ? orders.data : null
  usePageTitle(data?.shop ? `${data.shop.name} orders` : 'Orders')

  // Back to the overview with the same period and search.
  const backParams = new URLSearchParams(periodLinkParams({ period: preset, from, to }))
  if (search) backParams.set('q', search)

  if (orders.status === 'error' && !data) {
    return (
      <>
        <BackToShops search={backParams} />
        <p className={styles.message}>{orders.error}</p>
      </>
    )
  }

  const shop = data?.shop
  const emptyMessage = orders.status === 'loading' ? 'Loading orders…' : 'No orders match these filters.'

  return (
    <>
      <BackToShops search={backParams} />

      <header className={page.header}>
        <div className={page.heading}>
          <div className={styles.titleRow}>
            <h1 className={page.title}>{shop?.name ?? 'Orders'}</h1>
            {shop && <StatusBadge status={shop.status} />}
          </div>
          {shop && (
            <p className={page.subtitle}>
              {[shop.ref, shop.market, shop.whatsAppNumber && `WhatsApp ${formatPhone(shop.whatsAppNumber)}`]
                .filter(Boolean)
                .join(' · ')}{' '}
              · <Link to={`/vendors/${vendorId}`}>Shop profile</Link>
            </p>
          )}
        </div>

        <div className={page.toolbar}>
          <SearchField label="Search orders" placeholder="Order number, buyer or phone" value={searchInput} onChange={setSearchInput} />
          <PeriodFilter value={{ period: preset, from, to }} onChange={(changes) => updateParams({ ...changes, page: null })} />
        </div>
      </header>

      {data && <OrderSummaryTiles summary={data.summary} />}

      <FilterTabs
        label="Filter orders"
        tabs={SHOP_ORDER_TABS}
        active={tab.key}
        count={(t) => data?.counts[t.key]}
        onSelect={(key) => updateParams({ tab: key === DEFAULT_TAB.key ? null : key, page: null })}
      />

      <section className={table.panel} aria-label={`${tab.label} orders`}>
        <div className={orders.isFetching && data ? table.loading : undefined}>
          <OrdersTable orders={data?.items ?? []} emptyMessage={orders.status === 'error' ? orders.error : emptyMessage} />
        </div>
        <Pagination
          page={data?.page ?? pageNumber}
          pageSize={PAGE_SIZE}
          total={data?.total ?? 0}
          onPageChange={(next) => updateParams({ page: next > 1 ? String(next) : null })}
        />
      </section>
    </>
  )
}

/** Back to the all-shops overview, keeping its period and search. */
function BackToShops({ search }: { search: URLSearchParams }) {
  return (
    <BackLink to={`/orders${search.size ? `?${search}` : ''}`} small>
      All shops
    </BackLink>
  )
}
