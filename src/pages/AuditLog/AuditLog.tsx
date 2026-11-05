import { useCallback, useMemo, useState } from 'react'
import { SearchField, SelectField } from '@/components/FilterControls/FilterControls'
import { PeriodFilter } from '@/components/FilterControls/PeriodFilter'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAsync } from '@/hooks/useAsync'
import { pageParam, useSearchParamInput, useUrlParams } from '@/hooks/useUrlState'
import { exportAuditLog, fetchAuditAdmins, fetchAuditLog, type AuditAction, type AuditQuery } from '@/lib/audit'
import { AUDIT_ACTION, AUDIT_ACTION_GROUPS, AUDIT_ACTIONS } from '@/lib/auditDisplay'
import { downloadBlob } from '@/lib/csv'
import { periodParam } from '@/lib/orderDisplay'
import page from '@/styles/page.module.css'
import table from '@/styles/table.module.css'
import styles from './AuditLog.module.css'
import { AuditTable } from './AuditTable'

const PAGE_SIZE = 25

export function AuditLog() {
  const [params, updateParams] = useUrlParams()
  const [searchInput, setSearchInput, search] = useSearchParamInput(params, updateParams)
  const period = periodParam(params)
  const action = AUDIT_ACTIONS.find((a) => a === params.get('action')) ?? ''
  const adminId = params.get('admin') ?? ''
  const pageNumber = pageParam(params)

  const { period: preset, from, to } = period
  const query = useMemo<AuditQuery>(
    () => ({
      period: preset,
      from,
      to,
      action: action ? [action] : undefined,
      adminId: adminId || undefined,
      search: search || undefined,
    }),
    [preset, from, to, action, adminId, search],
  )
  const load = useCallback(() => fetchAuditLog({ ...query, page: pageNumber, pageSize: PAGE_SIZE }), [query, pageNumber])
  const log = useAsync(load)
  const admins = useAsync(fetchAuditAdmins)
  const data = log.status === 'success' ? log.data : null

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      const { blob, fileName } = await exportAuditLog(query)
      downloadBlob(fileName ?? `marketix-audit-log-${new Date().toISOString().slice(0, 10)}.csv`, blob)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const hasFilters = Boolean(action || adminId || search)
  const emptyMessage =
    log.status === 'loading'
      ? 'Loading activity…'
      : log.status === 'error'
        ? log.error
        : hasFilters
          ? 'No activity matches these filters.'
          : 'No admin activity in this period.'

  return (
    <>
      <header className={page.header}>
        <div className={page.heading}>
          <h1 className={page.title}>Audit log</h1>
          <p className={page.subtitle}>
            Every admin action: who did it, when, and why. Entries can’t be edited or deleted.
          </p>
        </div>
        <button
          className={styles.exportButton}
          type="button"
          disabled={exporting || !data?.total}
          onClick={handleExport}
        >
          <DownloadIcon />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </header>

      {exportError && (
        <p className={styles.error} role="alert">
          {exportError}
        </p>
      )}

      <div className={page.toolbar}>
        <SearchField
          label="Search the audit log"
          placeholder="Shop, ref, number, admin or details"
          value={searchInput}
          onChange={setSearchInput}
        />
        <SelectField<AuditAction | ''>
          label="Action"
          value={action}
          onChange={(value) => updateParams({ action: value, page: null })}
        >
          <option value="">All actions</option>
          {AUDIT_ACTION_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {AUDIT_ACTIONS.filter((a) => AUDIT_ACTION[a].group === group).map((a) => (
                <option key={a} value={a}>
                  {AUDIT_ACTION[a].label}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
        <SelectField label="Admin" value={adminId} onChange={(value) => updateParams({ admin: value, page: null })}>
          <option value="">All admins</option>
          {admins.status === 'success' &&
            admins.data.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.current ? admin.name : `${admin.name} (former admin)`}
              </option>
            ))}
        </SelectField>
        <PeriodFilter value={period} onChange={(changes) => updateParams({ ...changes, page: null })} />
        {hasFilters && (
          <button
            className={styles.clearButton}
            type="button"
            onClick={() => {
              setSearchInput('')
              updateParams({ action: null, admin: null, q: null, page: null })
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <section className={table.panel} aria-label="Audit entries">
        <div className={log.isFetching && data ? table.loading : undefined}>
          <AuditTable entries={data?.items ?? []} emptyMessage={emptyMessage} />
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

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
    </svg>
  )
}
