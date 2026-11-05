import { useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { useBlobUrl } from '@/hooks/useBlobUrl'
import { apiUrl } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { asJpegName, compressImage } from '@/lib/images'
import {
  cancelPendingShopBanner,
  fetchPendingShopBanner,
  fetchShopBanner,
  isReadOnly,
  MAX_BANNER_BYTES,
  MIN_BANNER_SIDE,
  removeShopBanner,
  uploadShopBanner,
  type ShopBanner,
  type TenantStatus,
} from '@/lib/vendorPortal'
import styles from '../vendor.module.css'
import local from './ShopBanner.module.css'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.')

/** The shop image buyers see beside the shop name on the WhatsApp order form, once an admin approves it. */
export function ShopBannerCard({ status }: { status: TenantStatus }) {
  const result = useAsync(fetchShopBanner)
  const [state, setState] = useState<ShopBanner | null>(null)
  const current = state ?? (result.status === 'success' ? result.data : null)

  return (
    <section className={styles.card} aria-labelledby="banner-title">
      <div>
        <h2 id="banner-title" className={styles.cardTitle}>
          Shop banner
        </h2>
        <p className={styles.muted}>
          A photo of your stall, shop sign or logo. Buyers see it as a small square next to your shop name on your WhatsApp order form, so they know
          they’re buying from you. We check each new banner before buyers see it.
        </p>
      </div>
      {result.status === 'loading' && <p className={styles.muted}>Loading…</p>}
      {result.status === 'error' && <p className={styles.alertError}>{result.error}</p>}
      {current && <BannerEditor banner={current} readOnly={isReadOnly(status)} onChange={setState} />}
    </section>
  )
}

interface BannerEditorProps {
  banner: ShopBanner
  readOnly: boolean
  onChange: (banner: ShopBanner) => void
}

function BannerEditor({ banner, readOnly, onChange }: BannerEditorProps) {
  const [busy, setBusy] = useState<'upload' | 'withdraw' | 'remove' | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justUploaded, setJustUploaded] = useState(false)
  const pendingSrc = useBlobUrl(banner.pendingAt, fetchPendingShopBanner)

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<ShopBanner>) {
    setBusy(kind)
    setError(null)
    try {
      onChange(await action())
      setJustUploaded(kind === 'upload')
      setConfirmRemove(false)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  /** Shrinks the picked image to a JPEG (kinder on mobile data), then sends it for approval. */
  async function pick(file: File) {
    if (!file.type.startsWith('image/')) return setError('Choose an image (JPEG, PNG or WebP).')
    await run('upload', async () => {
      let blob: Blob = file
      let name = file.name
      try {
        blob = await compressImage(file, 1600)
        name = asJpegName(file.name)
      } catch {
        // The browser can't read it (e.g. some HEIC photos); send it as it is if the API takes it.
        if (!IMAGE_TYPES.includes(file.type)) throw new Error('We couldn’t read that image. Please save it as a JPEG and try again.')
      }
      if (blob.size > MAX_BANNER_BYTES) throw new Error('Banners must be 5 MB or smaller.')
      return uploadShopBanner(blob, name)
    })
  }

  const liveSrc = banner.url ? apiUrl(banner.url) : null

  return (
    <div className={local.stack}>
      {banner.url && (
        <figure className={local.figure}>
          <div className={local.frame}>
            <img src={liveSrc!} alt="Your approved shop banner" />
          </div>
          <figcaption className={local.caption}>
            <span className={local.statusLive}>Live</span> Buyers see this banner.
          </figcaption>
        </figure>
      )}

      {banner.pendingAt && (
        <figure className={local.figure}>
          <div className={local.frame}>{pendingSrc ? <img src={pendingSrc} alt="Your new banner, waiting for approval" /> : null}</div>
          <figcaption className={local.caption}>
            <span className={local.statusPending}>Waiting for approval</span> Uploaded {formatDateTime(banner.pendingAt)}.
            {banner.url ? ' Buyers keep seeing your current banner until this one is approved.' : ' Buyers will see it once it’s approved.'}
          </figcaption>
        </figure>
      )}

      {!banner.url && !banner.pendingAt && (
        <div className={local.empty}>
          <span>No banner yet</span>
        </div>
      )}

      {justUploaded && banner.pendingAt && (
        <p className={styles.alertSuccess} role="status">
          Sent for approval. We’ll check it soon.
        </p>
      )}
      {banner.rejectedReason && !banner.pendingAt && (
        <p className={styles.alertWarning}>
          <strong>Your last banner wasn’t approved:</strong> {banner.rejectedReason} Please upload a new one.
        </p>
      )}
      {error && (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      )}

      {!readOnly && (
        <>
          <p className={styles.muted}>
            Use an image at least {MIN_BANNER_SIDE} pixels on each side. Buyers see the centre of it, cropped square like the
            preview above, so keep your logo or sign in the middle.
          </p>
          <div className={local.actions}>
            <label className={`${styles.secondary} ${styles.small} ${local.fileButton}`}>
              {busy === 'upload' ? 'Uploading…' : banner.url || banner.pendingAt ? 'Upload a new banner' : 'Upload banner'}
              <input
                type="file"
                accept="image/*"
                disabled={busy !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void pick(file)
                }}
              />
            </label>
            {banner.pendingAt && (
              <button className={styles.textButton} type="button" disabled={busy !== null} onClick={() => run('withdraw', cancelPendingShopBanner)}>
                {busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw new banner'}
              </button>
            )}
            {banner.url && !confirmRemove && (
              <button className={styles.dangerText} type="button" disabled={busy !== null} onClick={() => setConfirmRemove(true)}>
                Remove live banner
              </button>
            )}
          </div>
          {confirmRemove && (
            <div className={local.confirm} role="group" aria-label="Confirm removing the banner">
              <span>Buyers will stop seeing your banner straight away.</span>
              <div className={local.actions}>
                <button className={styles.dangerText} type="button" disabled={busy !== null} onClick={() => run('remove', removeShopBanner)}>
                  {busy === 'remove' ? 'Removing…' : 'Yes, remove it'}
                </button>
                <button className={styles.textButton} type="button" disabled={busy !== null} onClick={() => setConfirmRemove(false)}>
                  Keep it
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

