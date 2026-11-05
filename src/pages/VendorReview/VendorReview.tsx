import { useCallback, useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { BackLink } from '@/components/BackLink/BackLink'
import { StatusBadge } from '@/components/StatusBadge/StatusBadge'
import { useAsync } from '@/hooks/useAsync'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatWaiting, whatsAppLink } from '@/lib/format'
import { QUEUE_STATUSES } from '@/lib/vendorStatus'
import { fetchVendorDetail, startReview, type VendorDetail } from '@/lib/vendors'
import { BannerCard } from './BannerCard'
import { DecisionPanel } from './DecisionPanel'
import type { FlashTone, OnChanged } from './refreshOnConflict'
import { DocumentsCard, ReviewHistoryCard, ShopDetailsCard } from './DetailCards'
import { MoneyCard } from './MoneyCard'
import { SalesCard } from './SalesCard'
import { NotesCard } from './NotesCard'
import { ProductsCard } from './ProductsCard'
import { ActivePanel, NotSubmittedPanel, SuspendedPanel, WaitingOnVendorPanel } from './StatusPanels'
import styles from './VendorReview.module.css'

/** Optional router state from the page that linked here, so "Back" returns to it. */
export interface VendorLinkState {
  backTo: string
  backLabel: string
}

/** Route entry: remounts the page when the vendor id in the URL changes. */
export function VendorReviewPage() {
  const { vendorId = '' } = useParams()
  return <VendorReview key={vendorId} vendorId={vendorId} />
}

/** Opening a shop that is waiting marks it as taken (STOCKED → UNDER_REVIEW), so ticks can be saved. */
async function loadForReview(id: string): Promise<VendorDetail> {
  const vendor = await fetchVendorDetail(id)
  if (vendor.status !== 'READY_FOR_REVIEW') return vendor
  await startReview(id)
  return fetchVendorDetail(id)
}

function VendorReview({ vendorId }: { vendorId: string }) {
  const load = useCallback(() => loadForReview(vendorId), [vendorId])
  const detail = useAsync(load)
  const linkState = useLocation().state as VendorLinkState | null
  usePageTitle(detail.status === 'success' ? detail.data.shopName : 'Vendor')

  // Without a linking page, shops still in review go back to the queue; others to Vendors.
  const inQueue = detail.status !== 'success' || QUEUE_STATUSES.includes(detail.data.status)
  const back =
    linkState ??
    (inQueue ? { backTo: '/review-queue', backLabel: 'Back to review queue' } : { backTo: '/vendors', backLabel: 'Back to vendors' })

  return (
    <>
      <BackLink to={back.backTo} small>
        {back.backLabel}
      </BackLink>

      {detail.status === 'loading' && <p className={styles.message}>Loading vendor…</p>}
      {detail.status === 'error' && <p className={styles.message}>{detail.error}</p>}
      {detail.status === 'success' && <VendorReviewContent initialVendor={detail.data} />}
    </>
  )
}

function VendorReviewContent({ initialVendor }: { initialVendor: VendorDetail }) {
  const [vendor, setVendor] = useState(initialVendor)
  const [flash, setFlash] = useState<{ message: string; tone: FlashTone } | null>(null)
  // Bumped on every reload so the side panel starts fresh, even if the status didn't change.
  const [version, setVersion] = useState(0)

  /** After an action (or a 409): reload the shop (status, reviews, number) and say why. */
  async function handleChanged(message: string, tone: FlashTone = 'success') {
    setFlash({ message, tone })
    try {
      setVendor(await fetchVendorDetail(vendor.id))
    } catch {
      // The page just shows slightly old data until the next visit.
    }
    setVersion((v) => v + 1)
  }

  const waiting = (vendor.status === 'READY_FOR_REVIEW' || vendor.status === 'UNDER_REVIEW') && vendor.submittedAt
  const meta = [
    vendor.ref,
    `Signed up ${formatDate(vendor.signedUpAt)}`,
    waiting && `Waiting ${formatWaiting(vendor.submittedAt!)}`,
  ].filter(Boolean)

  return (
    <>
      <header className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{vendor.shopName}</h1>
            <StatusBadge status={vendor.status} />
          </div>
          <p className={styles.meta}>{meta.join(' · ')}</p>
        </div>

        {vendor.owner.phone && (
          <div className={styles.headerActions}>
            <a className={styles.secondaryButton} href={whatsAppLink(vendor.owner.phone)} target="_blank" rel="noreferrer">
              Message owner on WhatsApp
            </a>
          </div>
        )}
      </header>

      {flash && (
        <p className={flash.tone === 'warning' ? styles.flashWarning : styles.flash} role="status">
          {flash.message}
        </p>
      )}

      <div className={styles.columns}>
        <div className={styles.mainColumn}>
          <ShopDetailsCard vendor={vendor} />
          <DocumentsCard vendor={vendor} />
          <BannerCard vendor={vendor} onChanged={handleChanged} />
          <ProductsCard vendor={vendor} />
          {(vendor.status === 'ACTIVE' || vendor.status === 'SUSPENDED') && <MoneyCard vendor={vendor} />}
          {(vendor.status === 'ACTIVE' || vendor.status === 'SUSPENDED') && <SalesCard vendor={vendor} />}
          <NotesCard vendor={vendor} />
          <ReviewHistoryCard vendor={vendor} />
        </div>

        {/* Keyed so each panel starts fresh after every reload. */}
        <StatusPanel key={`${vendor.status}:${version}`} vendor={vendor} onChanged={handleChanged} />
      </div>
    </>
  )
}

interface StatusPanelProps {
  vendor: VendorDetail
  onChanged: OnChanged
}

function StatusPanel(props: StatusPanelProps) {
  switch (props.vendor.status) {
    case 'READY_FOR_REVIEW':
    case 'UNDER_REVIEW':
      return <DecisionPanel {...props} />
    case 'ACTIVE':
      return <ActivePanel {...props} />
    case 'SUSPENDED':
      return <SuspendedPanel {...props} />
    case 'PENDING_NO_PRODUCTS':
      return <NotSubmittedPanel {...props} />
    default:
      return <WaitingOnVendorPanel {...props} />
  }
}

