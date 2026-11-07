import { useCallback, useMemo } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import { SearchField } from '@/components/FilterControls/FilterControls'
import { Pagination } from '@/components/Pagination/Pagination'
import { StatCard, StatGrid } from '@/components/StatCard/StatCard'
import { useAsync } from '@/hooks/useAsync'
import { usePageTitle } from '@/hooks/usePageTitle'
import { pageParam, useSearchParamInput, useUrlParams } from '@/hooks/useUrlState'
import { cedis, formatDate } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { fetchPromoters, fetchPromotersSummary, PROMOTER_STATUS, type PromoterListItem, type PromoterStatusFilter } from '@/lib/promotersAdmin'
import page from '@/styles/page.module.css'
import table from '@/styles/table.module.css'

const PAGE_SIZE = 10

const TABS: { key: PromoterStatusFilter; label: string; count?: (s: { active: number; suspended: number; signingUp: number }) => number }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active', count: (s) => s.active },
  { key: 'suspended', label: 'Suspended', count: (s) => s.suspended },
  { key: 'signing_up', label: 'Signing up', count: (s) => s.signingUp },
]

/** Everyone who promotes shops: what they've brought in and earned, and anything that looks wrong. */
export function Promoters() {
  usePageTitle('Promoters')
  const [params, updateParams] = useUrlParams()
  const [searchInput, setSearchInput, search] = useSearchParamInput(params, updateParams)
  const status = TABS.find((t) => t.key === params.get('status'))?.key ?? 'all'
  const pageNumber = pageParam(params)

  const overview = useAsync(fetchPromotersSummary, { live: true })
  const summary = overview.status === 'success' ? overview.data : null
  const query = useMemo(() => ({ search: search || undefined, status, page: pageNumber, pageSize: PAGE_SIZE }), [search, status, pageNumber])
  const load = useCallback(() => fetchPromoters(query), [query])
  const result = useAsync(load, { live: true })
  const data = result.status === 'success' ? result.data : null
  const empty = result.status === 'loading' ? 'Loading promoters…' : result.status === 'error' ? result.error : search ? 'No promoters match.' : 'No promoters yet.'

  return (
    <>
      <header className={page.header}>
        <div className={page.heading}>
          <h1 className={page.title}>Promoters</h1>
          <p className={page.subtitle}>
            People who share shops’ links on WhatsApp and earn commission on new customers’ first orders. Shops approve them; you can suspend
            anyone who cheats.
          </p>
        </div>
        <div className={page.toolbar}>
          <SearchField label="Search promoters" placeholder="Name, phone or MoMo" value={searchInput} onChange={setSearchInput} />
        </div>
      </header>

      {summary && (
        <StatGrid label="Promoter totals">
          <StatCard label="Active promoters" value={summary.promoters.active} note={`${summary.promoters.signingUp} signing up`} />
          <StatCard label="Owed to promoters" value={cedis(summary.owedToPromoters)} note="Not withdrawn yet" />
          <StatCard label="Commission earned" value={cedis(summary.commissionLast30Days)} note="Last 30 days" />
          <StatCard
            label="Failed payouts"
            value={summary.failedPayouts}
            valueTone={summary.failedPayouts > 0 ? 'warning' : undefined}
            highlighted={summary.failedPayouts > 0}
            note={summary.failedPayouts > 0 ? 'Retry them on Payouts' : 'All clear'}
            noteTone={summary.failedPayouts > 0 ? 'warning' : 'muted'}
          />
        </StatGrid>
      )}

      <div className={page.tabs} role="group" aria-label="Filter by status">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={t.key === status ? page.tabActive : page.tab}
            aria-pressed={t.key === status}
            onClick={() => updateParams({ status: t.key === 'all' ? null : t.key, page: null })}
          >
            {t.label}
            {summary && t.count && <span className={page.tabCount}>{t.count(summary.promoters)}</span>}
          </button>
        ))}
      </div>

      <section className={table.panel} aria-label="Promoters">
        <div className={result.isFetching && data ? table.loading : undefined}>
          <div className={table.scroll}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th>Promoter</th>
                  <th>MoMo</th>
                  <th>Shops</th>
                  <th>Brought in</th>
                  <th>Earned</th>
                  <th>Ready to withdraw</th>
                </tr>
              </thead>
              <tbody>
                {!data?.data.length ? (
                  <tr>
                    <td className={table.emptyCell} colSpan={6}>
                      {empty}
                    </td>
                  </tr>
                ) : (
                  data.data.map((p) => <PromoterRow key={p.id} promoter={p} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination
          page={pageNumber}
          pageSize={PAGE_SIZE}
          total={data?.meta.total ?? 0}
          onPageChange={(next) => updateParams({ page: next > 1 ? String(next) : null })}
        />
      </section>
    </>
  )
}

function PromoterRow({ promoter: p }: { promoter: PromoterListItem }) {
  const status = PROMOTER_STATUS[p.status]
  return (
    <tr>
      <td>
        <div className={table.stack}>
          <Link className={table.primary} to={`/promoters/${p.id}`}>
            {p.fullName ?? 'Unnamed promoter'}
          </Link>
          <span className={table.secondary}>
            {formatPhone(p.phone, 'local')} · joined {formatDate(p.createdAt)}
            {p.status !== 'ACTIVE' && ' · '}
            {p.status !== 'ACTIVE' && <Badge tone={status.tone}>{status.label}</Badge>}
            {p.ownNumberOrders > 0 && ' · '}
            {p.ownNumberOrders > 0 && <Badge tone="warning">{p.ownNumberOrders} on own number</Badge>}
          </span>
        </div>
      </td>
      <td className={table.nowrap}>
        {p.momo.number ? (
          <div className={table.stack}>
            <span>{formatPhone(p.momo.number, 'local')}</span>
            <span className={table.secondary}>{p.momo.verified ? `${p.momo.name ?? ''} · checked` : 'Name not checked'}</span>
          </div>
        ) : (
          <span className={table.muted}>Not set</span>
        )}
      </td>
      <td className={table.nowrap}>{p.shops}</td>
      <td className={table.nowrap}>
        <div className={table.stack}>
          <span>
            {p.orders} {p.orders === 1 ? 'order' : 'orders'}
          </span>
          <span className={table.secondary}>
            {p.buyers} {p.buyers === 1 ? 'buyer' : 'buyers'} tapped
          </span>
        </div>
      </td>
      <td className={table.nowrap}>{cedis(p.earned)}</td>
      <td className={table.nowrap}>
        <strong>{cedis(Math.max(p.available, 0))}</strong>
        {p.balance > p.available && <span className={table.secondary}> + {cedis(p.balance - Math.max(p.available, 0))} held</span>}
      </td>
    </tr>
  )
}
