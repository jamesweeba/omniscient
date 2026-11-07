import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAction } from '@/hooks/useAction'
import { useAsync } from '@/hooks/useAsync'
import { usePageTitle } from '@/hooks/usePageTitle'
import { pageParam, useUrlParams } from '@/hooks/useUrlState'
import { isConflict } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { approveProductVideo, fetchWaitingVideos, MAX_VIDEO_SECONDS, rejectProductVideo, type WaitingVideo } from '@/lib/productVideos'
import { VideoPlayer } from '@/vendor/pages/ProductVideoCard'
import page from '@/styles/page.module.css'
import review from '../VendorReview/VendorReview.module.css'
import styles from './Videos.module.css'

const PAGE_SIZE = 6

/** Product videos waiting for approval, oldest first. Buyers only see approved ones. */
export function Videos() {
  usePageTitle('Videos')
  const [params, updateParams] = useUrlParams()
  const pageNumber = pageParam(params)
  const load = useCallback(() => fetchWaitingVideos(pageNumber, PAGE_SIZE), [pageNumber])
  const result = useAsync(load, { live: true })
  const data = result.status === 'success' ? result.data : null

  return (
    <>
      <header className={page.header}>
        <div className={page.heading}>
          <h1 className={page.title}>Videos to approve</h1>
          <p className={page.subtitle}>
            Short product videos from vendors (up to {MAX_VIDEO_SECONDS} seconds). Approve ones that honestly show the product; buyers then get a “🎥 Watch
            video” link on the order form. Reject anything misleading, offensive or unclear, with a reason the vendor will see.
          </p>
        </div>
      </header>

      {result.status === 'loading' && <p className={review.message}>Loading…</p>}
      {result.status === 'error' && <p className={review.message}>{result.error}</p>}
      {data && data.data.length === 0 && <p className={review.message}>No videos waiting. 🎉</p>}
      {data && data.data.length > 0 && (
        <>
          <div className={styles.grid}>
            {data.data.map((row) => (
              <VideoCard key={`${row.productId}:${row.measure?.code ?? ''}:${row.video.pending?.uploadedAt}`} row={row} />
            ))}
          </div>
          <Pagination page={pageNumber} pageSize={PAGE_SIZE} total={data.meta.total} onPageChange={(p) => updateParams({ page: p > 1 ? String(p) : null })} />
        </>
      )}
    </>
  )
}

function VideoCard({ row }: { row: WaitingVideo }) {
  const pending = row.video.pending
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const { pending: busy, error, run } = useAction()
  if (!pending) return null

  // A 409 means the vendor replaced or cancelled it meanwhile; the list reloads itself.
  const onError = (err: unknown) => (isConflict(err) ? 'The vendor changed this video. Showing the latest.' : null)

  async function reject(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim()) return
    await run(() => rejectProductVideo(row.productId, pending!.uploadedAt, reason.trim(), row.measure?.code ?? ''), { keepPendingOnSuccess: true, onError: (e) => onError(e) ?? 'Couldn’t reject it. Please try again.' })
  }

  return (
    <section className={review.card} aria-label={`${row.productName}${row.measure ? ` (${row.measure.label})` : ''} from ${row.tenant.name}`}>
      <div className={review.cardIntro}>
        <h2 className={review.cardTitle}>
          {row.productName}
          {row.measure ? ` · ${row.measure.label}` : ''}
        </h2>
        {row.measure && <p className={review.meta}>A video of this measure only.</p>}
        <p className={review.meta}>
          <Link to={`/vendors/${row.tenant.id}`}>{row.tenant.name}</Link> · uploaded {formatDateTime(pending.uploadedAt)}
          {pending.seconds ? ` · ${pending.seconds}s` : ''}
          {pending.trimmed ? ` · cut to ${MAX_VIDEO_SECONDS}s` : ''}
        </p>
        {row.video.live && <p className={review.meta}>Replaces the video buyers see now.</p>}
      </div>
      <VideoPlayer url={pending.url} posterUrl={pending.posterUrl} />
      {error && <p className={review.errorText}>{error}</p>}
      {rejecting ? (
        <form onSubmit={reject} noValidate className={styles.rejectForm}>
          <label className={review.formField}>
            <span className={review.formLabel}>Why? (the vendor sees this)</span>
            <textarea
              className={review.textarea}
              rows={2}
              maxLength={500}
              value={reason}
              autoFocus
              disabled={busy}
              placeholder="e.g. Too dark to see the product"
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className={review.headerActions}>
            <button className={review.dangerButton} type="submit" disabled={busy || !reason.trim()}>
              {busy ? 'Rejecting…' : 'Reject video'}
            </button>
            <button className={review.secondaryButton} type="button" disabled={busy} onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className={review.headerActions}>
          <button
            className={review.primaryButton}
            type="button"
            disabled={busy}
            onClick={() => run(() => approveProductVideo(row.productId, pending.uploadedAt, row.measure?.code ?? ''), { keepPendingOnSuccess: true, onError: (e) => onError(e) ?? 'Couldn’t approve it. Please try again.' })}
          >
            {busy ? 'Approving…' : 'Approve'}
          </button>
          <button className={review.dangerButton} type="button" disabled={busy} onClick={() => setRejecting(true)}>
            Reject
          </button>
        </div>
      )}
    </section>
  )
}
