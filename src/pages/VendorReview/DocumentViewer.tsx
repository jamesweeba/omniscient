import { useEffect, useState } from 'react'
import { Dialog } from '@/components/Dialog/Dialog'
import { useBlobFile } from '@/hooks/useBlobUrl'
import { formatShortDate } from '@/lib/format'
import { fetchVendorDocument, type VendorDocument } from '@/lib/vendors'
import styles from './VendorReview.module.css'

interface DocumentViewerProps {
  vendorId: string
  /** Uploaded documents. */
  documents: VendorDocument[]
  initialIndex: number
  /** Shown beside the document so the reviewer can compare names. */
  compare: { label: string; value: string }[]
  onClose: () => void
}


/** Previews KYC documents one at a time, with previous/next (also ← and → keys). */
export function DocumentViewer({ vendorId, documents, initialIndex, compare, onClose }: DocumentViewerProps) {
  const [index, setIndex] = useState(initialIndex)
  const doc = documents[index]
  const file = useDocumentFile(vendorId, doc?.id)
  const hasPrevious = index > 0
  const hasNext = index < documents.length - 1

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(documents.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [documents.length])

  if (!doc) return null
  const isPdf = doc.mimeType === 'application/pdf'

  return (
    <Dialog
      title={doc.title}
      description={`Uploaded ${formatShortDate(doc.uploadedAt)} · ${doc.fileName} · ${index + 1} of ${documents.length}`}
      size="wide"
      onClose={onClose}
    >
      <div className={styles.viewer}>
        <div className={styles.viewerFile}>
          {file.status === 'loading' && <p className={styles.mutedText}>Loading…</p>}
          {file.status === 'error' && <p className={styles.errorText}>{file.error}</p>}
          {file.status === 'ready' &&
            (isPdf ? (
              <iframe className={styles.viewerPdf} src={file.url} title={doc.title} />
            ) : (
              <img className={styles.viewerImage} src={file.url} alt={doc.title} />
            ))}
        </div>

        <aside className={styles.viewerSide} aria-label="Compare with">
          <h3 className={styles.viewerSideTitle}>Compare with</h3>
          <dl className={styles.viewerFacts}>
            {compare.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {file.status === 'ready' && (
            <a className={styles.textLink} href={file.url} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
          )}
        </aside>
      </div>

      <div className={styles.viewerNav}>
        <button className={styles.secondaryButton} type="button" disabled={!hasPrevious} onClick={() => setIndex(index - 1)}>
          ← {hasPrevious ? documents[index - 1].title : 'Previous'}
        </button>
        <button className={styles.secondaryButton} type="button" disabled={!hasNext} onClick={() => setIndex(index + 1)}>
          {hasNext ? documents[index + 1].title : 'Next'} →
        </button>
      </div>
    </Dialog>
  )
}

/** Fetches a document with the token and exposes it as an object URL (revoked on change). */
const useDocumentFile = (vendorId: string, documentId: string | undefined) =>
  useBlobFile(documentId ? `${vendorId}:${documentId}` : null, () => fetchVendorDocument(vendorId, documentId!))
