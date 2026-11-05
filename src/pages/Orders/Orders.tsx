import { useCallback, useMemo } from 'react'
import { SearchField, SelectField } from '@/components/FilterControls/FilterControls'
import { PeriodFilter } from '@/components/FilterControls/PeriodFilter'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAsync } from '@/hooks/useAsync'
import { pageParam, useSearchParamInput, useUrlParams } from '@/hooks/useUrlState'
import { periodParam } from '@/lib/orderDisplay'
import { fetchOrderOverview, type OrderOverviewQuery, type OrderShopSort } from '@/lib/orders'
import page from '@/styles/page.module.css'
import table from '@/styles/table.module.css'
import { OrderSummaryTiles } from './OrderSummaryTiles'
import { OrderVendorsTable } from './OrderVendorsTable'

const PAGE_SIZE = 10
const DEFAULT_SORT: OrderShopSort = 'orders'

const SORT_OPTIONS: { value: OrderShopSort; label: string }[] = [
  { value: 'orders', label: 'Most orders' },
  { value: 'sales', label: 'Most delivered sales' },
  { value: 'recent', label: 'Latest order first' },
]

export function Orders() {
  const [params, updateParams] = useUrlParams()
  const [searchInput, setSearchInput, search] = useSearchParamInput(params, updateParams)
  const period = periodParam(params)
  const sort = SORT_OPTIONS.find((o) => o.value === params.get('sort'))?.value ?? DEFAULT_SORT
  const pageNumber = pageParam(params)

  const { period: preset, from, to } = period
  const query = useMemo<OrderOverviewQuery>(
    () => ({ period: preset, from, to, search: search || undefined, sort, page: pageNumber, pageSize: PAGE_SIZE }),
    [preset, from, to, search, sort, pageNumber],
  )
  const load = useCallback(() => fetchOrderOverview(query), [query])
  const result = useAsync(load)
  const data = result.status === 'success' ? result.data : null

  const emptyMessage =
    result.status === 'loading'
      ? 'Loading orders…'
      : result.status === 'error'
        ? result.error
        : search
          ? 'No orders match your search in this period.'
          : 'No shop has placed orders in this period.'

  return (
    <>
      <header className={page.header}>
        <div className={page.heading}>
          <h1 className={page.title}>Orders</h1>
          <p className={page.subtitle}>
            Orders buyers placed with each shop on WhatsApp. Only paid orders (or cash on delivery) count.
          </p>
        </div>

        <div className={page.toolbar}>
          <SearchField
            label="Search shops and orders"
            placeholder="Shop, order number, buyer or phone"
            value={searchInput}
            onChange={setSearchInput}
          />
          <PeriodFilter value={period} onChange={(changes) => updateParams({ ...changes, page: null })} />
          <SelectField<OrderShopSort>
            label="Sort"
            value={sort}
            onChange={(value) => updateParams({ sort: value === DEFAULT_SORT ? null : value, page: null })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>
      </header>

      {data && <OrderSummaryTiles summary={data.summary} />}

      <section className={table.panel} aria-label="Shops">
        <div className={result.isFetching && data ? table.loading : undefined}>
          <OrderVendorsTable rows={data?.items ?? []} search={search} period={period} emptyMessage={emptyMessage} />
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
