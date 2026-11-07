import { useAction } from '@/hooks/useAction'
import { useBlobFile } from '@/hooks/useBlobUrl'
import type { VideosState } from '@/hooks/useProductVideos'
import {
  cancelProductVideo,
  fetchVideoFile,
  MAX_VIDEO_SECONDS,
  MAX_VIDEO_UPLOAD_BYTES,
  removeProductVideo,
  uploadProductVideo,
  type ProductVideo,
} from '@/lib/productVideos'
import { FileButton } from '@/vendor/FileButton'
import styles from '../vendor.module.css'
import local from './ProductVideoCard.module.css'

/** The whole product's video. */
const WHOLE = ''

/**
 * The video box under one measure in "How you sell it". Buyers who choose this measure and
 * tap "Watch video" get this one. A measure that isn't saved yet can't have a video.
 */
export function MeasureVideoBox({
  productId,
  measure,
  label,
  state,
  readOnly,
}: {
  /** Null for a product that isn't saved yet. */
  productId: string | null
  /** The measure's code, or null for a measure that isn't saved yet. */
  measure: string | null
  label: string
  state: VideosState
  readOnly: boolean
}) {
  const video = measure ? state.videoFor(measure) : null
  return (
    <div className={local.measureBox}>
      <span className={local.measureTitle}>🎥 Video{label.trim() ? ` of the ${label.trim().toLowerCase()}` : ''}</span>
      {!productId || !measure ? (
        <span className={styles.fieldHint}>Save changes to add a video for this measure.</span>
      ) : state.error ? (
        <span className={styles.fieldError}>{state.error}</span>
      ) : !video ? (
        <span className={styles.fieldHint}>Loading…</span>
      ) : (
        <VideoBody productId={productId} measure={measure} video={video} readOnly={readOnly} compact onChange={(v) => state.update(measure, v)} />
      )}
    </div>
  )
}

/**
 * The whole product's video. For a product sold at one price it's the product's video. A
 * product with measures has a video per measure instead, so this only shows a general video
 * uploaded earlier, which buyers still see for measures without their own, with a way to remove it.
 */
export function GeneralVideoCard({ productId, hasMeasures, state, readOnly }: { productId: string; hasMeasures: boolean; state: VideosState; readOnly: boolean }) {
  const video = state.videoFor(WHOLE)
  const hasGeneral = Boolean(video && (video.live || video.status !== 'NONE'))
  if (hasMeasures && !hasGeneral) return null

  return (
    <section className={styles.card} aria-labelledby="product-video">
      <h2 id="product-video" className={styles.cardTitle}>
        {hasMeasures ? 'General video' : 'Video'} <span className={styles.optional}>· optional</span>
      </h2>
      <p className={styles.muted}>
        {hasMeasures
          ? 'Each measure now has its own video above. Buyers still see this older general video for any measure without one; remove it once your measures have their own.'
          : `A short clip (up to ${MAX_VIDEO_SECONDS} seconds) so buyers can see what they’re buying. Buyers tap “🎥 Watch video” on the order form and it plays in their WhatsApp chat. MarketiX checks each video before buyers see it.`}
      </p>
      {state.error && <p className={styles.alertError}>{state.error}</p>}
      {!video && !state.error && <p className={styles.muted}>Loading…</p>}
      {video && (
        <VideoBody
          productId={productId}
          measure={WHOLE}
          video={video}
          // With measures, a general video can only be removed, not replaced.
          readOnly={readOnly}
          removeOnly={hasMeasures}
          onChange={(v) => state.update(WHOLE, v)}
        />
      )}
    </section>
  )
}

function VideoBody({
  productId,
  measure,
  video,
  readOnly,
  compact = false,
  removeOnly = false,
  onChange,
}: {
  productId: string
  /** '' for the whole product. */
  measure: string
  video: ProductVideo
  readOnly: boolean
  /** A smaller player, for the box under a measure. */
  compact?: boolean
  /** No uploading, only cancelling and removing. */
  removeOnly?: boolean
  onChange: (v: ProductVideo) => void
}) {
  const { pending: busy, error, setError, run } = useAction()

  function pick(file: File) {
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      setError('That video is over 100 MB. Record a shorter clip, or choose a lower quality in your camera settings.')
      return
    }
    void run(async () => onChange(await uploadProductVideo(productId, file, measure)), { fallback: 'The upload didn’t finish. Check your connection and try again.' })
  }

  const waiting = video.status === 'PROCESSING' || video.status === 'PENDING'
  const uploadLabel = busy ? 'Uploading…' : video.live || waiting ? 'Upload a new video' : 'Add a video'

  return (
    <>
      {video.live && (
        <div className={local.slot}>
          <span className={local.slotTitle}>
            Buyers see this video{video.live.seconds ? ` · ${video.live.seconds}s` : ''}
          </span>
          <VideoPlayer url={video.live.url} posterUrl={video.live.posterUrl} compact={compact} />
        </div>
      )}

      {video.status === 'PROCESSING' && (
        <p className={styles.alertInfo} role="status">
          ⏳ Preparing your video. This takes a moment; you can leave this page.
        </p>
      )}
      {video.status === 'PENDING' && video.pending && (
        <div className={local.slot}>
          <span className={local.slotTitle}>
            Waiting for MarketiX to approve{video.pending.seconds ? ` · ${video.pending.seconds}s` : ''}
          </span>
          {video.pending.trimmed && <span className={styles.fieldHint}>Your video was longer than {MAX_VIDEO_SECONDS} seconds, so we kept the first {MAX_VIDEO_SECONDS}.</span>}
          <VideoPlayer url={video.pending.url} posterUrl={video.pending.posterUrl} compact={compact} />
          {video.live && <span className={styles.fieldHint}>Buyers keep seeing your current video until this one is approved.</span>}
        </div>
      )}
      {(video.status === 'REJECTED' || video.status === 'FAILED') && video.message && (
        <p className={styles.alertWarning} role="alert">
          {video.status === 'REJECTED' ? 'Your video wasn’t approved: ' : ''}
          {video.message}
        </p>
      )}

      {error && (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      )}

      {!readOnly && (
        <div className={local.actions}>
          {!removeOnly && (
            <>
              <FileButton camera accept="video/*" onPick={pick} disabled={busy}>
                Record video
              </FileButton>
              <FileButton accept="video/*" onPick={pick} disabled={busy}>
                {uploadLabel}
              </FileButton>
            </>
          )}
          {(waiting || video.status === 'REJECTED' || video.status === 'FAILED') && (
            <button className={styles.textButton} type="button" disabled={busy} onClick={() => run(async () => onChange(await cancelProductVideo(productId, measure)))}>
              {waiting ? 'Cancel this upload' : 'Dismiss'}
            </button>
          )}
          {video.live && (
            <button
              className={styles.dangerText}
              type="button"
              disabled={busy}
              onClick={() => window.confirm('Remove this video? Buyers will stop seeing it.') && run(async () => onChange(await removeProductVideo(productId, measure)))}
            >
              Remove video
            </button>
          )}
        </div>
      )}
    </>
  )
}

/** Plays a protected video (fetched with the login token, so a plain src won't do). */
export function VideoPlayer({ url, posterUrl, compact = false }: { url: string; posterUrl?: string; compact?: boolean }) {
  const file = useBlobFile(url, () => fetchVideoFile(url), 'Couldn’t load the video.')
  const poster = useBlobFile(posterUrl ?? null, () => fetchVideoFile(posterUrl!))
  const className = compact ? `${local.player} ${local.playerCompact}` : local.player
  if (file.status === 'error') return <p className={styles.fieldError}>{file.error}</p>
  if (file.status === 'loading') return <div className={className} aria-busy="true" />
  return <video className={className} src={file.url} poster={poster.status === 'ready' ? poster.url : undefined} controls playsInline preload="metadata" />
}
