import { useState } from 'react'
import { Link } from 'react-router'
import { CameraIcon } from '@/components/icons/CameraIcon'
import { useAsync } from '@/hooks/useAsync'
import { useBlobUrl } from '@/hooks/useBlobUrl'
import { usePageTitle } from '@/hooks/usePageTitle'
import { errorMessage } from '@/lib/api'
import { DOCUMENT_SLOTS, REQUIRED_DOCUMENTS } from '@/lib/documentSlots'
import { formatShortDate } from '@/lib/format'
import { prepareUpload } from '@/lib/images'
import { DOCUMENT_TYPES, fetchDocumentFile, fetchDocuments, isKycLocked, isReadOnly, uploadDocument, type DocumentType, type ShopDocument } from '@/lib/vendorPortal'
import { FileButton } from '@/vendor/FileButton'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import docs from './Documents.module.css'
import { LockNotice, VendorPageHeader } from './VendorPageHeader'

type SlotState = { pending: boolean; error: string | null }

export function Documents() {
  usePageTitle('Documents')
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
      const { blob, name } = await prepareUpload(file, { maxSide: 1600, what: 'document' })

      await uploadDocument(type, blob, name)
      result.reload()
      setSlot(type, { pending: false, error: null })
    } catch (err) {
      setSlot(type, { pending: false, error: errorMessage(err, 'Upload failed. Please try again.') })
    }
  }

  return (
    <>
      <VendorPageHeader
        back={{ to: '/vendor', label: 'Home' }}
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
                    <FileButton
                      primary={!doc}
                      accept={slot.optional ? 'image/*,application/pdf' : 'image/*'}
                      disabled={state?.pending}
                      onPick={(file) => void handleFile(slot.type, file)}
                    >
                      {state?.pending ? 'Uploading…' : doc ? 'Replace' : slot.optional ? 'Add photo or PDF' : 'Add photo'}
                    </FileButton>
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

/** A thumbnail of an uploaded document. The file needs the token, so it's fetched as a blob. */
function Preview({ doc }: { doc: ShopDocument }) {
  // The thumbnail is a nicety; the file name still shows if it doesn't load.
  const url = useBlobUrl(doc.id, () => fetchDocumentFile(doc.id))
  const isPdf = doc.mimeType === 'application/pdf'

  const content = isPdf ? <span className={docs.pdfBadge}>PDF</span> : url ? <img src={url} alt="" /> : <CameraIcon />
  if (!url) return content
  return (
    <a className={docs.previewLink} href={url} target="_blank" rel="noreferrer" aria-label={`Open ${doc.fileName}`}>
      {content}
    </a>
  )
}
