import { useCallback, useEffect, useState } from 'react'
import { useAction } from '@/hooks/useAction'
import { useAsync } from '@/hooks/useAsync'
import { useBlobFile } from '@/hooks/useBlobUrl'
import {
  cancelProductVideo,
  fetchProductVideos,
  fetchVideoFile,
  MAX_VIDEO_SECONDS,
  MAX_VIDEO_UPLOAD_BYTES,
  removeProductVideo,
  uploadProductVideo,
  type ProductVideo,
  type ProductVideos,
} from '@/lib/productVideos'
import { FileButton } from '@/vendor/FileButton'
import styles from '../vendor.module.css'
import local from './ProductVideoCard.module.css'

/** How often to check on a video being converted. */
const POLL_MS = 3000
/** The whole product, as a "Video for" choice. */
const WHOLE = ''

/** A short sign of where a video stands, for the "Video for" choices. */
function statusMark(video: ProductVideo): string {
  if (video.status === 'PROCESSING' || video.status === 'PENDING') return ' ⏳'
  if (video.status === 'REJECTED' || video.status === 'FAILED') return ' ⚠️'
  return video.live ? ' 🎥' : ''
}

/**
 * Short videos of the product: one for the whole product, and one for each measure (an
 * olonka and a table top look very different). Each uploads straight away (not with "Save
 * changes"), is converted on the server, and buyers see it once MarketiX approves it.
 */
export function ProductVideoCard({ productId, readOnly }: { productId: string; readOnly: boolean }) {
  const load = useCallback(() => fetchProductVideos(productId), [productId])
  const result = useAsync(load, { live: true })
  const [videos, setVideos] = useState<ProductVideos | null>(null)
  const [seen, setSeen] = useState<ProductVideos | null>(null)
  const fresh = result.status === 'success' ? result.data : null
  if (fresh && fresh !== seen) {
    setSeen(fresh)
    setVideos(fresh)
  }
  const [target, setTarget] = useState(WHOLE)
  const { reload } = result

  // While the server converts a video, check back every few seconds.
  const processing = videos ? [videos.product, ...videos.measures.map((m) => m.video)].some((v) => v.status === 'PROCESSING') : false
  useEffect(() => {
    if (!processing) return
    const timer = setInterval(reload, POLL_MS)
    return () => clearInterval(timer)
  }, [processing, reload])

  const measure = videos?.measures.find((m) => m.code === target) ?? null
  const current = videos ? (measure ? measure.video : videos.product) : null
  const update = (video: ProductVideo) =>
    setVideos((v) => v && (measure ? { ...v, measures: v.measures.map((m) => (m.code === measure.code ? { ...m, video } : m)) } : { ...v, product: video }))

  return (
    <section className={styles.card} aria-labelledby="product-video">
      <h2 id="product-video" className={styles.cardTitle}>
        Videos <span className={styles.optional}>· optional</span>
      </h2>
      <p className={styles.muted}>
        Short clips (up to {MAX_VIDEO_SECONDS} seconds) so buyers can see what they’re buying. Buyers tap “🎥 Watch video” on the order form and it plays in
        their WhatsApp chat. MarketiX checks each video before buyers see it.
      </p>
      {result.status === 'loading' && !videos && <p className={styles.muted}>Loading…</p>}
      {result.status === 'error' && <p className={styles.alertError}>{result.error}</p>}

      {videos && videos.measures.length > 0 && (
        <div className={styles.field} role="group" aria-label="Video for">
          Video for
          <div className={styles.choices}>
            {[{ code: WHOLE, label: 'Whole product', video: videos.product }, ...videos.measures].map((m) => (
              <label key={m.code || 'whole'} className={styles.choice}>
                <input type="radio" name="video-for" checked={target === m.code} onChange={() => setTarget(m.code)} />
                {m.label}
                {statusMark(m.video)}
              </label>
            ))}
          </div>
          <span className={styles.fieldHint}>
            {measure
              ? `Buyers who choose ${measure.label} see this video. Without one, they see the whole product’s.`
              : 'Buyers see this one for any measure that has no video of its own. Add a video for a measure that looks different, e.g. a table top and an olonka.'}{' '}
            🎥 live · ⏳ waiting · ⚠️ needs attention. Save new measures first to give them a video.
          </span>
        </div>
      )}

      {current && <VideoBody key={target || 'whole'} productId={productId} measure={target} video={current} readOnly={readOnly} onChange={update} />}
    </section>
  )
}

function VideoBody({
  productId,
  measure,
  video,
  readOnly,
  onChange,
}: {
  productId: string
  /** '' for the whole product. */
  measure: string
  video: ProductVideo
  readOnly: boolean
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
          <VideoPlayer url={video.live.url} posterUrl={video.live.posterUrl} />
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
          <VideoPlayer url={video.pending.url} posterUrl={video.pending.posterUrl} />
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
          <FileButton camera accept="video/*" onPick={pick} disabled={busy}>
            Record video
          </FileButton>
          <FileButton accept="video/*" onPick={pick} disabled={busy}>
            {uploadLabel}
          </FileButton>
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
export function VideoPlayer({ url, posterUrl }: { url: string; posterUrl?: string }) {
  const file = useBlobFile(url, () => fetchVideoFile(url), 'Couldn’t load the video.')
  const poster = useBlobFile(posterUrl ?? null, () => fetchVideoFile(posterUrl!))
  if (file.status === 'error') return <p className={styles.fieldError}>{file.error}</p>
  if (file.status === 'loading') return <div className={local.player} aria-busy="true" />
  return <video className={local.player} src={file.url} poster={poster.status === 'ready' ? poster.url : undefined} controls playsInline preload="metadata" />
}
