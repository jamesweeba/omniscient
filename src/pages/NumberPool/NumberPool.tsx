import { useCallback, useState } from 'react'
import { StatCard, StatGrid } from '@/components/StatCard/StatCard'
import { useAsync } from '@/hooks/useAsync'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useUrlParams } from '@/hooks/useUrlState'
import { conflictNotice, errorMessage } from '@/lib/api'
import {
  COOLING_DAYS,
  fetchNumberPool,
  fetchPoolSummary,
  freeNumberNow,
  refreshAllNumbers,
  refreshNumber,
  type PoolFilter,
  type PoolNumber,
  type PoolSummary,
} from '@/lib/numbers'
import { formatPhone } from '@/lib/phone'
import page from '@/styles/page.module.css'
import table from '@/styles/table.module.css'
import { LOW_NUMBERS_THRESHOLD } from '../ReviewQueue/SummaryCards'
import { AddNumberDialog, AssignDialog, ReleaseDialog } from './NumberDialogs'
import styles from './NumberPool.module.css'
import { NumberTable } from './NumberTable'

const FILTERS: { key: PoolFilter; label: string; count: (s: PoolSummary) => number }[] = [
  { key: 'all', label: 'All', count: (s) => s.total },
  { key: 'free', label: 'Free', count: (s) => s.free },
  { key: 'assigned', label: 'Assigned', count: (s) => s.assigned },
  { key: 'cooling', label: 'Cooling', count: (s) => s.cooling },
  { key: 'quality', label: 'Quality issues', count: (s) => s.qualityIssues },
]

type OpenDialog = { kind: 'add' } | { kind: 'assign'; number: PoolNumber } | { kind: 'release'; number: PoolNumber }

type Flash = { tone: 'success' | 'error'; text: string }


export function NumberPool() {
  usePageTitle('WhatsApp numbers')
  const [params, updateParams] = useUrlParams()
  const filter = FILTERS.find((f) => f.key === params.get('show'))?.key ?? 'all'
  const load = useCallback(() => fetchNumberPool(filter), [filter])
  const pool = useAsync(load)
  const summary = useAsync(fetchPoolSummary)
  const [dialog, setDialog] = useState<OpenDialog | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refreshingAll, setRefreshingAll] = useState(false)

  const counts = summary.status === 'success' ? summary.data : null
  const lowOnNumbers = counts !== null && counts.free <= LOW_NUMBERS_THRESHOLD

  /** After any action: reload the table and the counts. */
  function done(message: Flash | null) {
    setDialog(null)
    setFlash(message)
    pool.reload()
    summary.reload()
  }

  async function rowAction(number: PoolNumber, action: () => Promise<string>) {
    setBusyId(number.id)
    try {
      done({ tone: 'success', text: await action() })
    } catch (err) {
      done({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusyId(null)
    }
  }

  function handleFreeNow(number: PoolNumber) {
    const phone = formatPhone(number.phone)
    if (!window.confirm(`Free ${phone} now? Buyers of the shop it belonged to may still message it.`)) return
    void rowAction(number, async () => {
      await freeNumberNow(number.id)
      return `${phone} is free and ready to assign.`
    })
  }

  function handleRefresh(number: PoolNumber) {
    void rowAction(number, async () => {
      await refreshNumber(number.id)
      return `${formatPhone(number.phone)} refreshed from Meta.`
    })
  }

  async function handleRefreshAll() {
    setRefreshingAll(true)
    setFlash(null)
    try {
      const result = await refreshAllNumbers()
      const failed = result.failed.map((f) => `${formatPhone(f.displayNumber)} (${f.error})`).join('; ')
      done(
        result.failed.length
          ? { tone: 'error', text: `Refreshed ${result.refreshed} of ${result.total}. Failed: ${failed}` }
          : { tone: 'success', text: `Refreshed all ${result.total} numbers from Meta.` },
      )
    } catch (err) {
      done({ tone: 'error', text: errorMessage(err) })
    } finally {
      setRefreshingAll(false)
    }
  }

  const emptyMessage =
    pool.status === 'loading' ? 'Loading numbers…' : pool.status === 'error' ? pool.error : 'No numbers match this filter.'

  return (
    <>
      <header className={page.header}>
        <div className={page.heading}>
          <h1 className={page.title}>WhatsApp number pool</h1>
          <p className={page.subtitle}>
            Numbers registered under the MarketiX WABA, one per active shop. Quality and tier are refreshed from Meta
            on demand.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} type="button" disabled={refreshingAll} onClick={handleRefreshAll}>
            {refreshingAll ? 'Refreshing… (about a second per number)' : 'Refresh all from Meta'}
          </button>
          <button className={styles.addButton} type="button" onClick={() => setDialog({ kind: 'add' })}>
            <PlusIcon />
            Add registered number
          </button>
        </div>
      </header>

      {flash && (
        <p className={flash.tone === 'success' ? styles.flash : styles.flashError} role="status">
          {flash.text}
        </p>
      )}

      {counts && (
        <StatGrid label="Pool summary">
          <StatCard label="Total in pool" value={counts.total} />
          <StatCard
            label="Free"
            value={counts.free}
            highlighted={counts.free === 0}
            valueTone={lowOnNumbers ? 'warning' : undefined}
            note={counts.free === 0 ? 'Approvals will fail: add a number' : lowOnNumbers ? 'Running low' : 'Ready to assign'}
            noteTone={lowOnNumbers ? 'warning' : 'muted'}
          />
          <StatCard label="Assigned" value={counts.assigned} />
          <StatCard label="Cooling" value={counts.cooling} note={`Free again after ${COOLING_DAYS} days`} />
        </StatGrid>
      )}

      <section className={table.panel} aria-label="Numbers">
        <div className={styles.filters} role="group" aria-label="Filter numbers">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={f.key === filter ? styles.chipActive : styles.chip}
              type="button"
              aria-pressed={f.key === filter}
              onClick={() => updateParams({ show: f.key === 'all' ? null : f.key })}
            >
              {f.label}
              {counts && ` · ${f.count(counts)}`}
            </button>
          ))}
        </div>

        <div className={pool.isFetching && pool.status === 'success' ? table.loading : undefined}>
          <NumberTable
            numbers={pool.status === 'success' ? pool.data : []}
            emptyMessage={emptyMessage}
            busyId={busyId}
            onAssign={(number) => setDialog({ kind: 'assign', number })}
            onRelease={(number) => setDialog({ kind: 'release', number })}
            onFreeNow={handleFreeNow}
            onRefresh={handleRefresh}
          />
        </div>
      </section>

      {dialog?.kind === 'add' && (
        <AddNumberDialog
          onClose={() => setDialog(null)}
          onAdded={(number) => done({ tone: 'success', text: `${formatPhone(number.phone)} added to the pool and ready to assign.` })}
        />
      )}
      {dialog?.kind === 'assign' && <AssignDialog number={dialog.number} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'release' && (
        <ReleaseDialog
          number={dialog.number}
          onClose={() => setDialog(null)}
          onReleased={(message) => done({ tone: 'success', text: message })}
          onConflict={(message) => done({ tone: 'error', text: conflictNotice(message) })}
        />
      )}
    </>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
