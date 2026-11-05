import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import { SearchField } from '@/components/FilterControls/FilterControls'
import { Pagination } from '@/components/Pagination/Pagination'
import { StatCard, StatGrid } from '@/components/StatCard/StatCard'
import { useAsync } from '@/hooks/useAsync'
import { pageParam, useSearchParamInput, useUrlParams } from '@/hooks/useUrlState'
import { onDataChanged } from '@/lib/dataEvents'
import { formatDateTime } from '@/lib/format'
import {
  cedis,
  fetchAllPayouts,
  fetchPayoutsOverview,
  fetchVendorBalances,
  PAYOUT_STATUS,
  payoutSourceLabel,
  retryPayout,
  type AdminPayout,
  type PayoutStatusFilter,
  type VendorBalance,
} from '@/lib/payouts'
import { formatPhone } from '@/lib/phone'
import page from '@/styles/page.module.css'
import table from '@/styles/table.module.css'
import type { VendorLinkState } from '../VendorReview/VendorReview'
import styles from './Payouts.module.css'

const PAGE_SIZE = 10

const VIEWS = [
  { key: 'balances', label: 'Vendor balances' },
  { key: 'payouts', label: 'Payouts' },
] as const
type View = (typeof VIEWS)[number]['key']

const STATUS_FILTERS: { key: PayoutStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'failed', label: 'Failed' },
  { key: 'processing', label: 'On its way' },
  { key: 'success', label: 'Paid' },
]

/** Money MarketiX owes vendors, and every MoMo payout sent to them. */
export function Payouts() {
  const [params, updateParams] = useUrlParams()
  const [searchInput, setSearchInput, search] = useSearchParamInput(params, updateParams)
  const view: View = params.get('view') === 'payouts' ? 'payouts' : 'balances'
  const status = STATUS_FILTERS.find((f) => f.key === params.get('status'))?.key ?? 'all'
  const pageNumber = pageParam(params)

  const overview = useAsync(fetchPayoutsOverview)
  const { reload } = overview
  useEffect(() => onDataChanged(reload), [reload])
  const summary = overview.status === 'success' ? overview.data : null

  return (
    <>
      <header className={page.header}>
        <div className={page.heading}>
          <h1 className={page.title}>Payouts</h1>
          <p className={page.subtitle}>
            Orders count once the buyer confirms delivery
            {summary ? `, less MarketiX’s ${summary.commissionPercent}% of the items` : ''}. Vendors withdraw their balance to MoMo themselves, once a
            day (Accra time).
          </p>
        </div>
        <div className={page.toolbar}>
          <SearchField label="Search" placeholder={view === 'balances' ? 'Shop, owner, ref or MoMo' : 'Shop, MoMo or reference'} value={searchInput} onChange={setSearchInput} />
        </div>
      </header>

      {summary && !summary.payoutsEnabled && (
        <p className={styles.notice} role="note">
          <strong>Payouts are switched off.</strong> Balances are worked out and shown, but no money is sent. Once Paystack has turned on
          Transfers for your account (with OTP off), set <code>PAYOUTS_ENABLED=true</code> on the server.
        </p>
      )}

      {summary && (
        <StatGrid label="Payout totals">
          <StatCard label="Owed to vendors" value={cedis(summary.owedToVendors)} note="Not withdrawn yet" />
          <StatCard label="Paid out" value={cedis(summary.last30Days.paidOut)} note="Last 30 days" />
          <StatCard label="MarketiX commission" value={cedis(summary.last30Days.commission)} note={`${summary.commissionPercent}% of items, last 30 days`} />
          <StatCard
            label="Failed payouts"
            value={summary.failedPayouts}
            valueTone={summary.failedPayouts > 0 ? 'warning' : undefined}
            highlighted={summary.failedPayouts > 0}
            note={summary.failedPayouts > 0 ? 'Retry them below' : 'All clear'}
            noteTone={summary.failedPayouts > 0 ? 'warning' : 'muted'}
          />
        </StatGrid>
      )}

      <div className={page.tabs} role="group" aria-label="View">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className={v.key === view ? page.tabActive : page.tab}
            aria-pressed={v.key === view}
            onClick={() => updateParams({ view: v.key === 'balances' ? null : v.key, status: null, page: null })}
          >
            {v.label}
            {v.key === 'payouts' && summary && summary.failedPayouts > 0 && <span className={page.tabCount}>{summary.failedPayouts} failed</span>}
          </button>
        ))}
      </div>

      {view === 'balances' ? (
        <BalancesTable search={search} pageNumber={pageNumber} onPage={(p) => updateParams({ page: p > 1 ? String(p) : null })} />
      ) : (
        <PayoutsTable
          search={search}
          status={status}
          pageNumber={pageNumber}
          onStatus={(s) => updateParams({ status: s === 'all' ? null : s, page: null })}
          onPage={(p) => updateParams({ page: p > 1 ? String(p) : null })}
        />
      )}
    </>
  )
}

interface ListProps {
  search: string
  pageNumber: number
  onPage: (page: number) => void
}

function BalancesTable({ search, pageNumber, onPage }: ListProps) {
  const location = useLocation()
  const backState: VendorLinkState = { backTo: location.pathname + location.search, backLabel: 'Back to payouts' }
  const load = useCallback(() => fetchVendorBalances({ search, page: pageNumber, pageSize: PAGE_SIZE }), [search, pageNumber])
  const result = useAsync(load)
  const data = result.status === 'success' ? result.data : null
  const empty = result.status === 'loading' ? 'Loading…' : result.status === 'error' ? result.error : search ? 'No shops match.' : 'No vendor has earned or owed anything yet.'

  return (
    <section className={table.panel} aria-label="Vendor balances">
      <div className={result.isFetching && data ? table.loading : undefined}>
        <div className={table.scroll}>
          <table className={table.table}>
            <thead>
              <tr>
                <th>Shop</th>
                <th>MoMo</th>
                <th>Balance</th>
                <th>On its way</th>
                <th>Paid out</th>
                <th>Last payout</th>
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
                data.data.map((v) => <BalanceRow key={v.id} vendor={v} backState={backState} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={pageNumber} pageSize={PAGE_SIZE} total={data?.meta.total ?? 0} onPageChange={onPage} />
    </section>
  )
}

function BalanceRow({ vendor, backState }: { vendor: VendorBalance; backState: VendorLinkState }) {
  return (
    <tr>
      <td>
        <div className={table.stack}>
          <Link className={table.primary} to={`/vendors/${vendor.id}`} state={backState}>
            {vendor.name}
          </Link>
          <span className={table.secondary}>
            {vendor.ref}
            {vendor.payoutsPaused && ' · '}
            {vendor.payoutsPaused && <Badge tone="warning">Paused</Badge>}
            {vendor.lastPayoutFailed && ' · '}
            {vendor.lastPayoutFailed && <Badge tone="danger">Last payout failed</Badge>}
          </span>
        </div>
      </td>
      <td className={table.nowrap}>{vendor.momoNumber ? formatPhone(vendor.momoNumber, 'local') : <span className={table.muted}>Not set</span>}</td>
      <td className={`${table.nowrap} ${vendor.balance < 0 ? table.warning : ''}`}>
        <strong>{cedis(vendor.balance)}</strong>
        {vendor.balance < 0 && <span className={table.secondary}> owed to MarketiX</span>}
      </td>
      <td className={table.nowrap}>{vendor.inFlight ? cedis(vendor.inFlight) : <span className={table.muted}>—</span>}</td>
      <td className={table.nowrap}>{cedis(vendor.paidOut)}</td>
      <td className={table.nowrap}>{vendor.lastPayoutAt ? formatDateTime(vendor.lastPayoutAt) : <span className={table.muted}>Never</span>}</td>
    </tr>
  )
}

function PayoutsTable({ search, status, pageNumber, onStatus, onPage }: ListProps & { status: PayoutStatusFilter; onStatus: (s: PayoutStatusFilter) => void }) {
  const query = useMemo(() => ({ search, status, page: pageNumber, pageSize: PAGE_SIZE }), [search, status, pageNumber])
  const load = useCallback(() => fetchAllPayouts(query), [query])
  const result = useAsync(load)
  const data = result.status === 'success' ? result.data : null
  const empty = result.status === 'loading' ? 'Loading…' : result.status === 'error' ? result.error : 'No payouts match.'

  return (
    <>
      <div className={styles.chips} role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} type="button" className={f.key === status ? styles.chipActive : styles.chip} aria-pressed={f.key === status} onClick={() => onStatus(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      <section className={table.panel} aria-label="Payouts">
        <div className={result.isFetching && data ? table.loading : undefined}>
          <div className={table.scroll}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Shop</th>
                  <th>Amount</th>
                  <th>MoMo</th>
                  <th>Status</th>
                  <th>
                    <span className={table.visuallyHidden}>Actions</span>
                  </th>
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
                  data.data.map((p) => <PayoutRow key={p.id} payout={p} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination page={pageNumber} pageSize={PAGE_SIZE} total={data?.meta.total ?? 0} onPageChange={onPage} />
      </section>
    </>
  )
}

function PayoutRow({ payout }: { payout: AdminPayout }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const display = PAYOUT_STATUS[payout.status]

  async function retry() {
    setPending(true)
    setError(null)
    try {
      await retryPayout(payout.id) // reloads the page's data on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t retry. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <tr>
      <td className={table.nowrap}>
        <div className={table.stack}>
          <span>{formatDateTime(payout.createdAt)}</span>
          <span className={table.secondary}>{payoutSourceLabel(payout)}</span>
        </div>
      </td>
      <td>
        <div className={table.stack}>
          <Link className={table.primary} to={`/vendors/${payout.tenant.id}`}>
            {payout.tenant.name}
          </Link>
          <span className={table.secondary}>{payout.tenant.ref}</span>
        </div>
      </td>
      <td className={table.nowrap}>
        <strong>{cedis(payout.amount)}</strong>
      </td>
      <td className={table.nowrap}>
        <div className={table.stack}>
          <span>{formatPhone(payout.momoNumber, 'local')}</span>
          {payout.momoName && <span className={table.secondary}>{payout.momoName}</span>}
        </div>
      </td>
      <td>
        <div className={table.stack}>
          <Badge tone={payout.superseded && payout.status === 'FAILED' ? 'neutral' : display.tone}>
            {payout.superseded && payout.status === 'FAILED' ? 'Failed · sent again later' : display.label}
          </Badge>
          {payout.status === 'SUCCESS' && payout.paidAt && <span className={table.secondary}>{formatDateTime(payout.paidAt)}</span>}
          {payout.failureReason && <span className={`${table.secondary} ${table.warning}`}>{payout.failureReason}</span>}
          {error && <span className={`${table.secondary} ${table.warning}`} role="alert">{error}</span>}
        </div>
      </td>
      <td className={table.actionCell}>
        {payout.status === 'FAILED' && !payout.superseded && (
          <button className={table.rowButton} type="button" disabled={pending} onClick={retry}>
            {pending ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </td>
    </tr>
  )
}
