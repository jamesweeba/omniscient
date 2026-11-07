import { useCallback, useEffect, useState } from 'react'
import { useAction } from '@/hooks/useAction'
import { useAsync } from '@/hooks/useAsync'
import { useBlobFile } from '@/hooks/useBlobUrl'
import {
  cancelProductVideo,
  fetchProductVideo,
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

/** How often to check on a video being converted. */
const POLL_MS = 3000

/**
 * A short video of the product. It uploads straight away (not with "Save changes"), is
 * converted on the server, and buyers see it once MarketiX approves it.
 */
export function ProductVideoCard({ productId, readOnly }: { productId: string; readOnly: boolean }) {
  const load = useCallback(() => fetchProductVideo(productId), [productId])
  const result = useAsync(load)
  const [video, setVideo] = useState<ProductVideo | null>(null)
  const fresh = result.status === 'success' ? result.data : null
  const [seen, setSeen] = useState<ProductVideo | null>(null)
  if (fresh && fresh !== seen) {
    setSeen(fresh)
    setVideo(fresh)
  }
  const { reload } = result

  // While the server converts the video, check back every few seconds.
  const processing = video?.status === 'PROCESSING'
  useEffect(() => {
    if (!processing) return
    const timer = setInterval(reload, POLL_MS)
    return () => clearInterval(timer)
  }, [processing, reload])

  return (
    <section className={styles.card} aria-labelledby="product-video">
      <h2 id="product-video" className={styles.cardTitle}>
        Video <span className={styles.optional}>· optional</span>
      </h2>
      <p className={styles.muted}>
        A short clip (up to {MAX_VIDEO_SECONDS} seconds) so buyers can see what they’re buying. Buyers tap “🎥 Watch video” on the order form and it plays in
        their WhatsApp chat. MarketiX checks each video before buyers see it.
      </p>
      {result.status === 'loading' && !video && <p className={styles.muted}>Loading…</p>}
      {result.status === 'error' && <p className={styles.alertError}>{result.error}</p>}
      {video && <VideoBody productId={productId} video={video} readOnly={readOnly} onChange={setVideo} />}
    </section>
  )
}

function VideoBody({ productId, video, readOnly, onChange }: { productId: string; video: ProductVideo; readOnly: boolean; onChange: (v: ProductVideo) => void }) {
  const { pending: busy, error, setError, run } = useAction()

  function pick(file: File) {
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      setError('That video is over 100 MB. Record a shorter clip, or choose a lower quality in your camera settings.')
      return
    }
    void run(async () => onChange(await uploadProductVideo(productId, file)), { fallback: 'The upload didn’t finish. Check your connection and try again.' })
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
            <button className={styles.textButton} type="button" disabled={busy} onClick={() => run(async () => onChange(await cancelProductVideo(productId)))}>
              {waiting ? 'Cancel this upload' : 'Dismiss'}
            </button>
          )}
          {video.live && (
            <button
              className={styles.dangerText}
              type="button"
              disabled={busy}
              onClick={() => window.confirm('Remove this video? Buyers will stop seeing it.') && run(async () => onChange(await removeProductVideo(productId)))}
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
