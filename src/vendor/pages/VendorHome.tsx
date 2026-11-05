import QRCode from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/context/auth-context'
import { formatDateTime } from '@/lib/format'
import { sendOrderForm } from '@/lib/orders'
import { formatPhone, parseGhanaPhone } from '@/lib/phone'
import { useAsync } from '@/hooks/useAsync'
import { fetchShop, resubmitShop, type ShopStatus, type StepKey } from '@/lib/vendorPortal'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import home from './VendorHome.module.css'

/** The checklist steps, grouped by the page where the vendor fixes them. */
const GROUPS: { title: string; to: string; keys: StepKey[] }[] = [
  { title: 'Shop details', to: '/vendor/shop', keys: ['shop', 'ownerDetails', 'momoPayout'] },
  { title: 'Documents', to: '/vendor/documents', keys: ['ghanaCardFront', 'ghanaCardBack', 'stallPhoto'] },
  { title: 'Products', to: '/vendor/products', keys: ['products'] },
]

export function VendorHome() {
  const { session } = useAuth()
  const { shop } = useVendorPortal()
  const details = useAsync(fetchShop)
  // The layout only renders this page once the shop exists.
  if (!shop) return null

  const approved = shop.steps.find((step) => step.key === 'approved')

  return (
    <>
      <div className={styles.heading}>
        <h1 className={styles.title}>Hi, {session?.user.firstName}</h1>
        <p className={styles.lead}>{details.status === 'success' ? details.data.name : (shop?.number?.displayName ?? '\u00a0')}</p>
      </div>

      <StatusCard shop={shop} ownerPhone={details.status === 'success' ? details.data.ownerPhone : null} />

      <section className={home.steps} aria-label="Your checklist">
        {GROUPS.map((group, index) => {
          const steps = group.keys.map((key) => shop.steps.find((step) => step.key === key)).filter((step) => !!step)
          const done = steps.every((step) => step.done)
          return (
            <Link key={group.to} className={home.step} to={group.to}>
              <span className={done ? home.stepDone : home.stepNumber} aria-hidden="true">
                {done ? <CheckIcon /> : index + 1}
              </span>
              <div className={home.stepText}>
                <span className={home.stepTitle}>
                  {group.title}
                  <span className={styles.visuallyHiddenInline}>{done ? ' (done)' : ''}</span>
                </span>
                <ul className={home.items}>
                  {steps.map((step) => (
                    <li key={step.key} className={step.done ? home.itemDone : home.item}>
                      {step.label}
                      <span className={styles.visuallyHiddenInline}>{step.done ? ' (done)' : ' (to do)'}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <span className={home.stepAction}>{done ? 'View' : 'Start'}</span>
            </Link>
          )
        })}
        {approved && (
          <div className={home.stepStatic}>
            <span className={approved.done ? home.stepDone : home.stepNumber} aria-hidden="true">
              {approved.done ? <CheckIcon /> : GROUPS.length + 1}
            </span>
            <span className={home.stepText}>
              <span className={home.stepTitle}>{approved.label}</span>
              <span className={home.stepSummary}>
                {approved.done ? 'Done' : 'Happens once your details, documents and a product are in.'}
              </span>
            </span>
          </div>
        )}
      </section>
    </>
  )
}

interface Banner {
  tone: string
  title: string
  body: ReactNode
}

function StatusCard({ shop, ownerPhone }: { shop: ShopStatus; ownerPhone: string | null }) {
  const { status, latestReview, number, canResubmit } = shop

  if (status === 'ACTIVE' && number) return <LiveCard number={number} ownerPhone={ownerPhone} />

  const banners: Record<ShopStatus['status'], Banner> = {
    PENDING: {
      tone: home.statusNeutral,
      title: 'Add your first product to get reviewed',
      body: (
        <>
          Your shop goes to MarketiX for review as soon as it has a product in stock. Finish the checklist below too, so
          we can approve it quickly.{' '}
          <Link to="/vendor/products/new">Add a product</Link>
        </>
      ),
    },
    STOCKED: {
      tone: home.statusInfo,
      title: 'Waiting for review',
      body: 'Your shop is in the MarketiX queue. Keep the checklist complete; we’ll let you know when it’s reviewed.',
    },
    UNDER_REVIEW: {
      tone: home.statusInfo,
      title: 'Being reviewed',
      body: 'MarketiX is checking your details now. Your owner and MoMo details and documents are locked until we finish.',
    },
    MORE_INFO: {
      tone: home.statusWarning,
      title: 'We need a few changes',
      body: 'Make the changes below, then resubmit your shop.',
    },
    REJECTED: {
      tone: home.statusDanger,
      title: 'Not approved yet',
      body: 'If you can fix the reason below, make the changes and resubmit.',
    },
    ACTIVE: {
      tone: home.statusInfo,
      title: 'Your shop is approved',
      body: 'Your WhatsApp number will appear here soon.',
    },
    SUSPENDED: {
      tone: home.statusDanger,
      title: 'Your shop is suspended',
      body: 'Buyers can’t order from you and your shop can’t be changed right now. Contact MarketiX support.',
    },
  }
  const banner = banners[status]
  const showNotes = (status === 'MORE_INFO' || status === 'REJECTED' || status === 'SUSPENDED') && latestReview?.notes

  return (
    <section className={banner.tone} aria-labelledby="status">
      <h2 id="status" className={styles.cardTitle}>
        {banner.title}
      </h2>
      {showNotes && (
        <blockquote className={home.note}>
          <p>{latestReview.notes}</p>
          <footer>MarketiX · {formatDateTime(latestReview.createdAt)}</footer>
        </blockquote>
      )}
      <p className={home.statusText}>{banner.body}</p>
      {canResubmit && <ResubmitButton />}
    </section>
  )
}

function ResubmitButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    try {
      // The layout refreshes the status after any change, which hides this button.
      await resubmitShop()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPending(false)
    }
  }

  return (
    <>
      <button className={styles.primary} type="button" disabled={pending} onClick={handleClick}>
        {pending ? 'Resubmitting…' : 'Resubmit for review'}
      </button>
      {error && (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      )}
    </>
  )
}

interface LiveCardProps {
  number: NonNullable<ShopStatus['number']>
  /** The vendor's own phone, for the test order. */
  ownerPhone: string | null
}

function LiveCard({ number, ownerPhone }: LiveCardProps) {
  const [copied, setCopied] = useState(false)
  const digits = parseGhanaPhone(number.displayNumber)?.digits ?? number.displayNumber.replace(/\D/g, '')
  const link = `https://wa.me/${digits}?text=Hi`
  const qr = useQrCode(link)

  return (
    <section className={home.statusLive} aria-labelledby="status">
      <h2 id="status" className={styles.cardTitle}>
        🎉 Your shop is live
      </h2>
      <p className={home.statusText}>Buyers order from you on this WhatsApp number:</p>
      <span className={home.bigNumber}>{formatPhone(number.displayNumber, 'local')}</span>
      {number.displayName && <p className={home.statusText}>Buyers see it as “{number.displayName}”.</p>}

      {qr && (
        <div className={home.qr}>
          <img src={qr} alt={`QR code that opens a WhatsApp chat with ${number.displayName || 'your shop'}`} width={180} height={180} />
          <span className={home.statusText}>Print this and put it on your stall. Buyers scan it to order.</span>
        </div>
      )}

      <div className={home.statusActions}>
        <button
          className={`${styles.primary} ${styles.small}`}
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(link)
            setCopied(true)
          }}
        >
          {copied ? 'Link copied' : 'Copy link for customers'}
        </button>
        {qr && (
          <a className={`${styles.secondary} ${styles.small}`} href={qr} download="marketix-shop-qr.png">
            Save QR code
          </a>
        )}
      </div>
      <p className={home.link}>{link}</p>

      {ownerPhone && <TestOrderButton ownerPhone={ownerPhone} />}
    </section>
  )
}

/** Draws the link as a QR code (as a PNG data URL), in the browser. */
function useQrCode(text: string): string | null {
  const [qr, setQr] = useState<{ text: string; url: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(text, { width: 360, margin: 1 }).then(
      (url) => !cancelled && setQr({ text, url }),
      () => {}, // Without a QR code, the link still works.
    )
    return () => {
      cancelled = true
    }
  }, [text])
  return qr?.text === text ? qr.url : null
}

/** Sends the WhatsApp order form to the vendor's own phone, to try ordering like a buyer. */
function TestOrderButton({ ownerPhone }: { ownerPhone: string }) {
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'sent' } | { kind: 'error'; message: string }>({ kind: 'idle' })

  async function handleClick() {
    setState({ kind: 'sending' })
    try {
      await sendOrderForm(ownerPhone)
      setState({ kind: 'sent' })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Couldn’t send it. Please try again.' })
    }
  }

  return (
    <div className={home.testOrder}>
      <button className={`${styles.secondary} ${styles.small}`} type="button" disabled={state.kind === 'sending'} onClick={handleClick}>
        {state.kind === 'sending' ? 'Sending…' : 'Send test order'}
      </button>
      <span className={home.statusText} role="status">
        {state.kind === 'sent'
          ? `Sent to ${formatPhone(ownerPhone, 'local')}. Open WhatsApp to try ordering like a buyer.`
          : state.kind === 'error'
            ? state.message
            : `We send the order form to your phone, ${formatPhone(ownerPhone, 'local')}.`}
      </span>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  )
}
