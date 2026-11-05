import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAsync } from '@/hooks/useAsync'
import { DOCUMENT_SLOTS, REQUIRED_DOCUMENTS } from '@/lib/documentSlots'
import { formatShortDate } from '@/lib/format'
import { asJpegName, compressImage } from '@/lib/images'
import {
  DOCUMENT_TYPES,
  fetchDocumentFile,
  fetchDocuments,
  isKycLocked,
  isReadOnly,
  MAX_DOCUMENT_BYTES,
  uploadDocument,
  type DocumentType,
  type ShopDocument,
} from '@/lib/vendorPortal'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import docs from './Documents.module.css'
import { LockNotice, VendorPageHeader } from './VendorPageHeader'

type SlotState = { pending: boolean; error: string | null }

export function Documents() {
  const { shop } = useVendorPortal()
  const result = useAsync(fetchDocuments)
  const [slotState, setSlotState] = useState<Partial<Record<DocumentType, SlotState>>>({})
  if (!shop) return null

  const editable = !isKycLocked(shop.status) && !isReadOnly(shop.status)
  const uploaded = result.status === 'success' ? result.data : []
  const byType = (type: DocumentType) => uploaded.find((doc) => doc.type === type)
  const requiredDone = REQUIRED_DOCUMENTS.every((slot) => byType(slot.type))
  const productsDone = shop.steps.find((step) => step.key === 'products')?.done
  const setSlot = (type: DocumentType, state: SlotState) => setSlotState((current) => ({ ...current, [type]: state }))

  async function handleFile(type: DocumentType, file: File) {
    setSlot(type, { pending: true, error: null })
    try {
      if (!DOCUMENT_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
        throw new Error('Upload a JPEG, PNG, WebP or PDF file.')
      }
      const { blob, name } = await prepare(file)
      if (blob.size > MAX_DOCUMENT_BYTES) throw new Error('Documents must be 5 MB or smaller.')

      await uploadDocument(type, blob, name)
      result.reload()
      setSlot(type, { pending: false, error: null })
    } catch (err) {
      setSlot(type, { pending: false, error: err instanceof Error ? err.message : 'Upload failed. Please try again.' })
    }
  }

  return (
    <>
      <VendorPageHeader
        title="Documents"
        lead="We use these to confirm who you are before giving you a WhatsApp number. Only the MarketiX team sees them."
      />
      <LockNotice status={shop.status} what="your documents" />
      {result.status === 'error' && <p className={styles.alertError}>{result.error}</p>}

      <div className={docs.list}>
        {DOCUMENT_SLOTS.map((slot) => {
          const doc = byType(slot.type)
          const state = slotState[slot.type]
          return (
            <section key={slot.type} className={docs.slot} aria-labelledby={`doc-${slot.type}`}>
              <div className={docs.preview}>
                {doc ? <Preview key={`${doc.id}-${doc.uploadedAt}`} doc={doc} /> : <CameraIcon />}
              </div>

              <div className={docs.body}>
                <h2 id={`doc-${slot.type}`} className={docs.title}>
                  {slot.title}
                  {slot.optional && <span className={docs.optional}> · optional</span>}
                </h2>
                <p className={docs.hint}>
                  {doc ? `Uploaded ${formatShortDate(doc.uploadedAt)} · ${doc.fileName}` : result.status === 'loading' ? 'Loading…' : slot.hint}
                </p>
                {state?.error && (
                  <p className={styles.fieldError} role="alert">
                    {state.error}
                  </p>
                )}

                {editable && result.status === 'success' && (
                  <div className={docs.actions}>
                    <label className={`${doc ? styles.secondary : styles.primary} ${styles.small} ${docs.fileButton}`}>
                      {state?.pending ? 'Uploading…' : doc ? 'Replace' : slot.optional ? 'Add photo or PDF' : 'Add photo'}
                      <input
                        type="file"
                        accept={slot.optional ? 'image/*,application/pdf' : 'image/*'}
                        disabled={state?.pending}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          if (file) void handleFile(slot.type, file)
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {editable &&
        result.status === 'success' &&
        (requiredDone ? (
          <Link className={styles.primary} to={productsDone ? '/vendor' : '/vendor/products'}>
            {productsDone ? 'Done' : 'Continue to products'}
          </Link>
        ) : (
          <p className={styles.muted}>Add the Ghana Card (both sides) and a photo of your stall.</p>
        ))}
    </>
  )
}

/** Photos are shrunk to a JPEG; PDFs (and photos the browser can't read) go up as they are. */
async function prepare(file: File): Promise<{ blob: Blob; name: string }> {
  if (file.type === 'application/pdf') return { blob: file, name: file.name }
  try {
    return { blob: await compressImage(file), name: asJpegName(file.name) }
  } catch {
    if (DOCUMENT_TYPES.includes(file.type)) return { blob: file, name: file.name }
    throw new Error('We couldn’t read that photo. Please take it again as a JPEG.')
  }
}

/** A thumbnail of an uploaded document. The file needs the token, so it's fetched as a blob. */
function Preview({ doc }: { doc: ShopDocument }) {
  const [url, setUrl] = useState<string | null>(null)
  const isPdf = doc.mimeType === 'application/pdf'

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    fetchDocumentFile(doc.id).then(
      (blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      },
      () => {}, // The thumbnail is a nicety; the file name still shows.
    )
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [doc.id])

  const content = isPdf ? <span className={docs.pdfBadge}>PDF</span> : url ? <img src={url} alt="" /> : <CameraIcon />
  if (!url) return content
  return (
    <a className={docs.previewLink} href={url} target="_blank" rel="noreferrer" aria-label={`Open ${doc.fileName}`}>
      {content}
    </a>
  )
}

function CameraIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}
