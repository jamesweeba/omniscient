import { useMemo } from 'react'
import { SearchField } from '@/components/FilterControls/FilterControls'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAsync } from '@/hooks/useAsync'
import { pageParam, useUrlParams } from '@/hooks/useUrlState'
import { QUEUE_FILTERS } from '@/lib/vendorStatus'
import { fetchAdminSummary, fetchReviewQueue, type VendorStatus } from '@/lib/vendors'
import page from '@/styles/page.module.css'
import table from '@/styles/table.module.css'
import { DailySummary } from './DailySummary'
import { SummaryCards } from './SummaryCards'
import { VendorTable } from './VendorTable'

const PAGE_SIZE = 10
const ALL_STATUSES = [...new Set(QUEUE_FILTERS.flatMap((f) => f.statuses))]
const loadQueue = () => fetchReviewQueue(ALL_STATUSES)

export function ReviewQueue() {
  // One request for every chip; the list isn't paginated, so filtering is local.
  const queue = useAsync(loadQueue)
  const summary = useAsync(fetchAdminSummary)
  const [params, update] = useUrlParams()
  const filter = QUEUE_FILTERS.find((f) => f.key === params.get('show')) ?? QUEUE_FILTERS[0]
  const search = params.get('q') ?? ''
  const pageNumber = pageParam(params)

  const all = useMemo(() => (queue.status === 'success' ? queue.data : []), [queue])
  const matchesSearch = useMemo(() => {
    const term = search.trim().toLowerCase()
    return all.filter(
      (v) =>
        !term ||
        [v.shopName, v.ref, v.ownerName, v.ownerPhone ?? '', v.market ?? ''].some((field) => field.toLowerCase().includes(term)),
    )
  }, [all, search])
  const count = (statuses: VendorStatus[]) => matchesSearch.filter((v) => statuses.includes(v.status)).length

  const filtered = matchesSearch.filter((v) => filter.statuses.includes(v.status))
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(pageNumber, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const oldestWaiting = all
    .filter((v) => QUEUE_FILTERS[0].statuses.includes(v.status) && v.queuedAt)
    .map((v) => v.queuedAt!)
    .sort()[0]

  const emptyMessage =
    queue.status === 'loading' ? 'Loading vendors…' : queue.status === 'error' ? queue.error : 'No vendors match your filters.'

  return (
    <>
      <header className={page.header}>
        <div className={page.heading}>
          <h1 className={page.title}>Review queue</h1>
          <p className={page.subtitle}>Shops with products in stock, waiting for due diligence. Oldest first.</p>
        </div>

        <div className={page.toolbar}>
          <SearchField
            label="Search vendors"
            placeholder="Search shop, ref, owner or phone"
            value={search}
            onChange={(value) => update({ q: value, page: null }, { replace: true })}
          />
        </div>
      </header>

      <DailySummary />

      {summary.status === 'success' && <SummaryCards summary={summary.data} oldestWaiting={oldestWaiting ?? null} />}

      <div className={page.tabs} role="group" aria-label="Filter by status">
        {QUEUE_FILTERS.map((f, index) => (
          <button
            key={f.key}
            className={f.key === filter.key ? page.tabActive : page.tab}
            type="button"
            aria-pressed={f.key === filter.key}
            onClick={() => update({ show: index === 0 ? null : f.key, page: null })}
          >
            {f.label}
            {queue.status === 'success' && <span className={page.tabCount}>{count(f.statuses)}</span>}
          </button>
        ))}
      </div>

      <section className={table.panel} aria-label={filter.label}>
        <VendorTable vendors={visible} emptyMessage={emptyMessage} />
        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={(next) => update({ page: next > 1 ? String(next) : null })}
        />
      </section>
    </>
  )
}
