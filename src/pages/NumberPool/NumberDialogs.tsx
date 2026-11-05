import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Dialog } from '@/components/Dialog/Dialog'
import { useAction } from '@/hooks/useAction'
import { useAsync } from '@/hooks/useAsync'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { errorMessage, isConflict } from '@/lib/api'
import { formatWaiting } from '@/lib/format'
import { addNumber, COOLING_DAYS, releaseNumber, type PoolNumber } from '@/lib/numbers'
import { formatPhone, parseGhanaPhone } from '@/lib/phone'
import { fetchReviewQueue, fetchVendors } from '@/lib/vendors'
import form from '@/styles/form.module.css'
import styles from './NumberPool.module.css'

// ---------------------------------------------------------------------------
// Add
// ---------------------------------------------------------------------------

interface AddNumberDialogProps {
  onClose: () => void
  onAdded: (number: PoolNumber) => void
}

/** The backend checks the id and number with Meta before saving, so its errors are shown as they are. */
export function AddNumberDialog({ onClose, onAdded }: AddNumberDialogProps) {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [phone, setPhone] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [wabaId, setWabaId] = useState('')
  const { pending, error, setError, run } = useAction()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const id = phoneNumberId.replace(/\s/g, '')
    const parsed = parseGhanaPhone(phone)
    if (!/^\d{6,20}$/.test(id)) return setError('Enter the phone number id from WhatsApp Manager (digits only).')
    if (!parsed) return setError('Enter the phone number, e.g. 0205960861 or +233 20 596 0861.')

    const input = { phoneNumberId: id, displayNumber: parsed.compact, displayName: displayName.trim() || undefined, wabaId: wabaId.trim() || undefined }
    await run(async () => onAdded(await addNumber(input)), { keepPendingOnSuccess: true })
  }

  return (
    <Dialog
      title="Add registered number"
      description="A number already registered under the MarketiX WABA in WhatsApp Manager. We check it with Meta before saving."
      onClose={onClose}
    >
      <form className={form.form} onSubmit={handleSubmit} noValidate>
        <label className={form.field}>
          <span className={form.label}>Phone number id</span>
          <input
            className={form.input}
            inputMode="numeric"
            placeholder="1404916169377344"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            autoFocus
          />
          <span className={form.hint}>Meta’s numeric id (WhatsApp Manager → Phone numbers), not the phone number.</span>
        </label>
        <label className={form.field}>
          <span className={form.label}>Phone number</span>
          <input
            className={form.input}
            type="tel"
            inputMode="tel"
            placeholder="0205960861"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className={form.field}>
          <span className={form.label}>
            Display name <span className={form.hint}>(optional)</span>
          </span>
          <input className={form.input} placeholder="The name verified on Meta" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className={form.field}>
          <span className={form.label}>
            WABA id <span className={form.hint}>(optional)</span>
          </span>
          <input className={form.input} inputMode="numeric" placeholder="Defaults to the MarketiX WABA" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
        </label>

        {error && (
          <p className={form.error} role="alert">
            {error}
          </p>
        )}

        <div className={form.actions}>
          <button className={form.secondary} type="button" onClick={onClose}>
            Cancel
          </button>
          <button className={form.primary} type="submit" disabled={pending}>
            {pending ? 'Checking with Meta…' : 'Add number'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Assign
// ---------------------------------------------------------------------------

interface AssignDialogProps {
  number: PoolNumber
  onClose: () => void
}

/**
 * There is no direct "assign": numbers go to a shop when it is approved. Pick a shop waiting
 * for review and finish on its review screen, with this number preselected.
 */
export function AssignDialog({ number, onClose }: AssignDialogProps) {
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search.trim())
  const load = useCallback(
    () =>
      term
        ? fetchVendors({ tab: 'pending_review', search: term, sort: 'newest', page: 1, pageSize: 50 }).then((r) =>
            r.items.map((v) => ({ id: v.id, shopName: v.shopName, market: v.market, queuedAt: null as string | null })),
          )
        : fetchReviewQueue(['READY_FOR_REVIEW', 'UNDER_REVIEW']),
    [term],
  )
  const shops = useAsync(load)
  const phone = formatPhone(number.phone)

  return (
    <Dialog
      title={`Assign ${phone}`}
      description="Pick a shop waiting for review. You’ll finish on its review screen with this number preselected; the four due-diligence checks are still needed."
      onClose={onClose}
    >
      <label className={form.field}>
        <span className={form.label}>Search shops waiting for review</span>
        <input className={form.input} type="search" placeholder="Shop, owner, ref or phone" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
      </label>

      {shops.status === 'loading' && <p className={form.hint}>Loading shops…</p>}
      {shops.status === 'error' && <p className={form.error}>{shops.error}</p>}
      {shops.status === 'success' && shops.data.length === 0 && (
        <p className={form.hint}>{term ? 'No waiting shops match.' : 'No shops are waiting for review.'}</p>
      )}
      {shops.status === 'success' && shops.data.length > 0 && (
        <ul className={styles.candidates}>
          {shops.data.map((shop) => (
            <li key={shop.id} className={styles.candidate}>
              <span className={styles.candidateText}>
                <span className={styles.candidateName}>{shop.shopName}</span>
                <span className={form.hint}>
                  {[shop.market, shop.queuedAt && `waiting ${formatWaiting(shop.queuedAt)}`].filter(Boolean).join(' · ') || ' '}
                </span>
              </span>
              <Link className={styles.candidateLink} to={`/vendors/${shop.id}?number=${number.id}`}>
                Review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Release
// ---------------------------------------------------------------------------

interface ReleaseDialogProps {
  number: PoolNumber
  onClose: () => void
  onReleased: (message: string) => void
  /** A 409: the number changed under us. The page closes the dialog and reloads. */
  onConflict: (message: string) => void
}

/** Releasing the number of an open shop suspends the shop too, so a reason is needed then. */
export function ReleaseDialog({ number, onClose, onReleased, onConflict }: ReleaseDialogProps) {
  const [reason, setReason] = useState('')
  const { pending, error, setError, run } = useAction()
  const shop = number.vendor
  const shopOpen = shop !== null && shop.status !== 'SUSPENDED'
  const phone = formatPhone(number.phone)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (shopOpen && !reason.trim()) return setError('Give a reason. The vendor sees it.')

    await run(
      async () => {
        const result = await releaseNumber(number.id, shopOpen ? reason.trim() : undefined)
        onReleased(`${phone} released and cooling for ${COOLING_DAYS} days.${result.suspended && shop ? ` ${shop.shopName} is suspended.` : ''}`)
      },
      {
        keepPendingOnSuccess: true,
        // Someone else already released or reassigned it: close and show the latest.
        onError: (err) => (isConflict(err) ? (onConflict(err.message), null) : errorMessage(err)),
      },
    )
  }

  return (
    <Dialog
      title={`Release ${phone}`}
      description={
        shopOpen
          ? `${shop.shopName} will be suspended and lose this number. Buyers will be told the shop is closed. The number cools for ${COOLING_DAYS} days before it can be reused.`
          : `${shop ? `${shop.shopName} is suspended and will lose this number. ` : ''}The number cools for ${COOLING_DAYS} days before it can be reused.`
      }
      onClose={onClose}
    >
      <form className={form.form} onSubmit={handleSubmit} noValidate>
        {shopOpen && (
          <label className={form.field}>
            <span className={form.label}>Reason (shown to the vendor)</span>
            <textarea
              className={form.textarea}
              rows={3}
              placeholder="e.g. Shop closed permanently; owner confirmed by phone."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setError(null)
              }}
              autoFocus
            />
          </label>
        )}

        {error && (
          <p className={form.error} role="alert">
            {error}
          </p>
        )}

        <div className={form.actions}>
          <button className={form.secondary} type="button" onClick={onClose}>
            Cancel
          </button>
          <button className={form.danger} type="submit" disabled={pending}>
            {pending ? 'Releasing…' : shopOpen ? 'Suspend shop and release' : 'Release number'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
