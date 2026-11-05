import { useCallback, useMemo } from 'react'
import { SearchField, SelectField } from '@/components/FilterControls/FilterControls'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAsync } from '@/hooks/useAsync'
import { pageParam, useSearchParamInput, useUrlParams } from '@/hooks/useUrlState'
import { VENDOR_TABS } from '@/lib/vendorStatus'
import { fetchMarkets, fetchVendors, type VendorListQuery, type VendorSort } from '@/lib/vendors'
import page from '@/styles/page.module.css'
import table from '@/styles/table.module.css'
import { VendorsTable } from './VendorsTable'

const PAGE_SIZE = 10
const DEFAULT_TAB = VENDOR_TABS[0]
const DEFAULT_SORT: VendorSort = 'newest'

const SORT_OPTIONS: { value: VendorSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'orders', label: 'Most orders (30 days)' },
]

export function Vendors() {
  // The URL is the source of truth for filters, so links and the back button work.
  const [params, updateParams] = useUrlParams()
  const [searchInput, setSearchInput, search] = useSearchParamInput(params, updateParams)
  const tab = VENDOR_TABS.find((t) => t.key === params.get('tab')) ?? DEFAULT_TAB
  const sort = SORT_OPTIONS.find((o) => o.value === params.get('sort'))?.value ?? DEFAULT_SORT
  const market = params.get('market') ?? ''
  const bannerPending = params.get('banner') === 'pending'
  const pageNumber = pageParam(params)

  const query = useMemo<VendorListQuery>(
    () => ({
      tab: tab.key,
      search: search || undefined,
      market: market || undefined,
      bannerPending,
      sort,
      page: pageNumber,
      pageSize: PAGE_SIZE,
    }),
    [tab, search, market, bannerPending, sort, pageNumber],
  )
  const loadVendors = useCallback(() => fetchVendors(query), [query])
  const vendors = useAsync(loadVendors)
  const markets = useAsync(fetchMarkets)

  const data = vendors.status === 'success' ? vendors.data : null
  const emptyMessage =
    vendors.status === 'loading' ? 'Loading vendors…' : vendors.status === 'error' ? vendors.error : 'No vendors match your filters.'

  return (
    <>
      <header className={page.header}>
        <div className={page.heading}>
          <h1 className={page.title}>Vendors</h1>
          <p className={page.subtitle}>Every shop on MarketiX. Search by shop, owner, ref, phone or WhatsApp number.</p>
        </div>

        <div className={page.toolbar}>
          <SearchField label="Search vendors" placeholder="Shop, owner, ref or phone" value={searchInput} onChange={setSearchInput} />
          <SelectField label="Market" value={market} onChange={(value) => updateParams({ market: value, page: null })}>
            <option value="">All markets</option>
            {markets.status === 'success' &&
              markets.data.map(({ market: name, count }) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
          </SelectField>
          <SelectField
            label="Banner"
            value={bannerPending ? 'pending' : ''}
            onChange={(value) => updateParams({ banner: value || null, page: null })}
          >
            <option value="">Any banner</option>
            <option value="pending">Banner waiting for approval</option>
          </SelectField>
          <SelectField<VendorSort>
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

      <div className={page.tabs} role="group" aria-label="Filter by status">
        {VENDOR_TABS.map((t) => (
          <button
            key={t.key}
            className={t.key === tab.key ? page.tabActive : page.tab}
            type="button"
            aria-pressed={t.key === tab.key}
            onClick={() => updateParams({ tab: t.key === DEFAULT_TAB.key ? null : t.key, page: null })}
          >
            {t.label}
            {data && <span className={page.tabCount}>{data.counts[t.key]}</span>}
          </button>
        ))}
      </div>

      <section className={table.panel} aria-label={`${tab.label} vendors`}>
        <div className={vendors.isFetching && data ? table.loading : undefined}>
          <VendorsTable vendors={data?.items ?? []} emptyMessage={emptyMessage} />
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
