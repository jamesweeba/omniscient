import { useState } from 'react'
import { useAction } from '@/hooks/useAction'
import { useBlobUrl } from '@/hooks/useBlobUrl'
import { apiUrl, conflictNotice, errorMessage, isConflict } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { approveBanner, fetchPendingBanner, rejectBanner, removeBanner, type VendorDetail } from '@/lib/vendors'
import type { OnChanged } from './refreshOnConflict'
import styles from './VendorReview.module.css'


type Mode = { kind: 'idle' } | { kind: 'reject' } | { kind: 'remove' }

/**
 * The shop image buyers see beside the shop name on the order form. A vendor's new upload waits here for an
 * admin to approve or reject it; a live banner can be taken down.
 */
export function BannerCard({ vendor, onChanged }: { vendor: VendorDetail; onChanged: OnChanged }) {
  const { banner } = vendor
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [reason, setReason] = useState('')
  const { pending, error, setError, run } = useAction()
  const pendingSrc = useBlobUrl(banner.pendingAt && `${vendor.id}:${banner.pendingAt}`, () => fetchPendingBanner(vendor.id))

  const act = (action: () => Promise<unknown>, success: string) =>
    run(
      async () => {
        await action()
        setMode({ kind: 'idle' })
        setReason('')
        onChanged(success)
      },
      // Someone else acted, or the vendor uploaded a newer banner: show the latest.
      { onError: (err) => (isConflict(err) ? (onChanged(conflictNotice(err.message), 'warning'), null) : errorMessage(err)) },
    )

  const needsReason = mode.kind !== 'idle'

  return (
    <section className={styles.card} aria-labelledby="banner">
      <div className={styles.cardHeader}>
        <h2 id="banner" className={styles.cardTitle}>
          Shop banner
        </h2>
        {banner.pendingAt && <span className={styles.bannerBadge}>Waiting for approval</span>}
      </div>

      {banner.pendingAt && (
        <figure className={styles.bannerFigure}>
          <div className={styles.bannerFrame}>{pendingSrc && <img src={pendingSrc} alt={`New banner uploaded by ${vendor.shopName}`} />}</div>
          <figcaption className={styles.mutedText}>
            New upload, {formatDateTime(banner.pendingAt)}. Check that it shows this shop (its sign, stall, goods or logo) and
            nothing offensive or misleading. Buyers see the centre as a small square, as shown.
          </figcaption>
        </figure>
      )}

      {banner.url && (
        <figure className={styles.bannerFigure}>
          <div className={styles.bannerFrame}>
            <img src={apiUrl(banner.url)} alt={`${vendor.shopName}'s live banner`} />
          </div>
          <figcaption className={styles.mutedText}>{banner.pendingAt ? 'Live now, until the new one is approved.' : 'Live: buyers see this beside the shop name on the order form.'}</figcaption>
        </figure>
      )}

      {!banner.url && !banner.pendingAt && <p className={styles.mutedText}>No banner uploaded.</p>}
      {banner.rejectedReason && !banner.pendingAt && (
        <p className={styles.mutedText}>Last banner turned down: {banner.rejectedReason}</p>
      )}

      {needsReason && (
        <div className={styles.formField}>
          <label className={styles.formLabel} htmlFor="banner-reason">
            {mode.kind === 'reject' ? 'Why not approve it?' : 'Why take it down?'}{' '}
            <span className={styles.formLabelHint}>(the vendor sees this)</span>
          </label>
          <textarea
            id="banner-reason"
            className={styles.textarea}
            rows={2}
            maxLength={500}
            placeholder="e.g. The photo shows another shop’s name. Please upload a photo of your own stall."
            value={reason}
            disabled={pending}
            autoFocus
            onChange={(e) => {
              setReason(e.target.value)
              setError(null)
            }}
          />
        </div>
      )}

      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}

      <div className={styles.bannerActions}>
        {mode.kind === 'idle' && banner.pendingAt && (
          <>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={pending}
              onClick={() => act(() => approveBanner(vendor.id, banner.pendingAt!), 'Banner approved. Buyers now see it.')}
            >
              {pending ? 'Approving…' : 'Approve banner'}
            </button>
            <button className={styles.dangerButton} type="button" disabled={pending} onClick={() => setMode({ kind: 'reject' })}>
              Reject
            </button>
          </>
        )}
        {mode.kind === 'idle' && banner.url && !banner.pendingAt && (
          <button className={styles.dangerButton} type="button" disabled={pending} onClick={() => setMode({ kind: 'remove' })}>
            Take banner down
          </button>
        )}
        {needsReason && (
          <>
            <button
              className={styles.dangerButton}
              type="button"
              disabled={pending || !reason.trim()}
              onClick={() =>
                mode.kind === 'reject'
                  ? act(() => rejectBanner(vendor.id, banner.pendingAt!, reason.trim()), 'Banner rejected. The vendor sees your reason.')
                  : act(() => removeBanner(vendor.id, reason.trim()), 'Banner taken down. Buyers no longer see it.')
              }
            >
              {pending ? 'Saving…' : mode.kind === 'reject' ? 'Reject banner' : 'Take it down'}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={pending}
              onClick={() => {
                setMode({ kind: 'idle' })
                setReason('')
                setError(null)
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </section>
  )
}

