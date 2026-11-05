import { useState } from 'react'
import { DOCUMENT_SLOTS } from '@/lib/documentSlots'
import { formatCedis, formatDateTime, formatShortDate } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { REVIEW_DECISION } from '@/lib/reviewDisplay'
import { CHECKLIST } from '@/lib/checklist'
import type { VendorDetail } from '@/lib/vendors'
import { DocumentViewer } from './DocumentViewer'
import styles from './VendorReview.module.css'

const orNotSet = (value: string | null | undefined) => value || 'Not set'

export function ShopDetailsCard({ vendor }: { vendor: VendorDetail }) {
  const { delivery, momo } = vendor
  const fields: [label: string, value: string][] = [
    ['Owner (as on Ghana Card)', vendor.owner.name],
    ['Owner phone', vendor.owner.phone ? formatPhone(vendor.owner.phone, 'local') : 'Not set'],
    ['Account', `${vendor.account.name} · ${vendor.account.email}`],
    ['Market / stall', [vendor.market, vendor.stall].filter(Boolean).join(' · ') || 'Not set'],
    ['MoMo payout number', momo.number ? formatPhone(momo.number, 'local') : 'Not set'],
    ['MoMo registered name', orNotSet(momo.registeredName)],
    ['Delivery fee', formatCedis(delivery.fee)],
    ['Delivery areas', delivery.areas.map((a) => a.title).join(', ') || 'None'],
    ['Delivery times', ['Now · within 1 hour', ...delivery.slots.map((s) => s.title)].join(', ')],
  ]
  if (delivery.pickupNote) fields.push(['Pickup', delivery.pickupNote])
  if (vendor.description) fields.push(['About the shop', vendor.description])

  return (
    <section className={styles.card} aria-labelledby="shop-details">
      <h2 id="shop-details" className={styles.cardTitle}>
        Shop and owner
      </h2>
      <dl className={styles.fields}>
        {fields.map(([label, value]) => (
          <div key={label} className={styles.field}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function DocumentsCard({ vendor }: { vendor: VendorDetail }) {
  const [viewing, setViewing] = useState<number | null>(null)
  const { documents } = vendor
  const required = DOCUMENT_SLOTS.filter((slot) => !slot.optional)
  const requiredDone = required.filter((slot) => documents.some((d) => d.type === slot.type)).length

  return (
    <section className={styles.card} aria-labelledby="documents">
      <div className={styles.cardHeader}>
        <h2 id="documents" className={styles.cardTitle}>
          ID documents
        </h2>
        <span className={requiredDone === required.length ? styles.countComplete : styles.countIncomplete}>
          {requiredDone} of {required.length} required uploaded
        </span>
      </div>

      <ul className={styles.documents}>
        {DOCUMENT_SLOTS.map((slot) => {
          const doc = documents.find((d) => d.type === slot.type)
          return (
            <li key={slot.type} className={styles.document}>
              <span className={styles.documentThumb}>
                <ImageIcon />
              </span>
              <span className={styles.documentText}>
                <span className={styles.documentTitle}>{slot.title}</span>
                <span className={styles.documentMeta}>
                  {doc
                    ? `${formatShortDate(doc.uploadedAt)} · ${doc.mimeType === 'application/pdf' ? 'PDF' : 'Image'} · ${Math.ceil(doc.size / 1024)} KB`
                    : slot.optional
                      ? 'Not uploaded · optional'
                      : 'Not uploaded'}
                </span>
              </span>
              {doc ? (
                <button className={styles.textButton} type="button" onClick={() => setViewing(documents.indexOf(doc))}>
                  Open
                </button>
              ) : (
                <span className={styles.textLinkDisabled}>Open</span>
              )}
            </li>
          )
        })}
      </ul>
      <p className={styles.optionHint}>Each document you open is recorded in the audit log.</p>
      {viewing !== null && (
        <DocumentViewer
          vendorId={vendor.id}
          documents={documents}
          initialIndex={viewing}
          compare={[
            { label: 'Owner', value: vendor.owner.name },
            { label: 'MoMo registered name', value: orNotSet(vendor.momo.registeredName) },
            { label: 'Market / stall', value: [vendor.market, vendor.stall].filter(Boolean).join(' · ') || 'Not set' },
          ]}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  )
}

export function ReviewHistoryCard({ vendor }: { vendor: VendorDetail }) {
  return (
    <section className={styles.card} aria-labelledby="history">
      <h2 id="history" className={styles.cardTitle}>
        Review history
      </h2>
      {vendor.reviews.length === 0 ? (
        <p className={styles.mutedText}>No decisions yet.</p>
      ) : (
        <ol className={styles.timeline}>
          {vendor.reviews.map((review) => {
            const display = REVIEW_DECISION[review.decision]
            const ticked = review.checks ? CHECKLIST.filter((c) => review.checks?.[c.key]) : []
            return (
              <li key={review.id} className={styles.timelineItem}>
                <span className={styles[display.dot]} aria-hidden="true" />
                <div className={styles.timelineText}>
                  <span>
                    <strong>{display.label}</strong>
                    {review.reviewer && ` by ${review.reviewer.firstName} ${review.reviewer.lastName}`} · {formatDateTime(review.createdAt)}
                  </span>
                  {review.notes && <span className={styles.mutedText}>{review.notes}</span>}
                  {review.checks && (
                    <span className={styles.reviewChecks}>
                      Checks: {ticked.length} of {CHECKLIST.length}
                      {ticked.length > 0 && ticked.length < CHECKLIST.length && ` (${ticked.map((c) => c.title).join(', ')})`}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function ImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m3 16 5-5 4 4 3-3 6 6" />
    </svg>
  )
}

export function WarningIcon() {
  return (
    <svg className={styles.noticeIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}
