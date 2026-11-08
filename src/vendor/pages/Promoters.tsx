import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge/Badge'
import { Dialog } from '@/components/Dialog/Dialog'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAction } from '@/hooks/useAction'
import { useAsync } from '@/hooks/useAsync'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cedis, formatDate, plural } from '@/lib/format'
import { formatPhone, parseGhanaPhone } from '@/lib/phone'
import {
  addPromoLink,
  approvePromoter,
  cancelInvite,
  declinePromoter,
  fetchPromoterSales,
  fetchPromoters,
  fetchPromotionSettings,
  invitePromoter,
  keepsOf100,
  linkLabel,
  removePromoLink,
  removePromoter,
  saleState,
  SALES_PAGE_SIZE,
  updatePromotionSettings,
  type PromoterRow,
  type PromotionSettings,
} from '@/lib/promotions'
import { fetchProducts, isReadOnly, type Product } from '@/lib/vendorPortal'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import promo from './Promoters.module.css'
import { VendorPageHeader } from './VendorPageHeader'

/** Promoters share the shop's links on WhatsApp and earn a commission on new customers' first orders. */
export function Promoters() {
  usePageTitle('Promoters')
  const { shop } = useVendorPortal()
  const settings = useAsync(fetchPromotionSettings, { live: true })
  const readOnly = shop ? isReadOnly(shop.status) : true

  return (
    <>
      <VendorPageHeader
        title="Promoters"
        lead="People who share your shop on WhatsApp and earn a commission when a new customer orders through their link."
      />
      {readOnly && shop && <p className={styles.alertError}>Your shop is suspended, so you can’t make changes. Contact MarketiX support.</p>}
      {settings.status === 'loading' && <p className={styles.centered}>Loading…</p>}
      {settings.status === 'error' && <p className={styles.alertError}>{settings.error}</p>}
      {settings.status === 'success' && (
        <div className={styles.columns}>
          <div className={styles.stack}>
            {settings.data.promotionsEnabled ? <PromoterLists settings={settings.data} readOnly={readOnly} /> : <HowItWorks />}
          </div>
          <SettingsCard settings={settings.data} readOnly={readOnly} />
        </div>
      )}
    </>
  )
}

/** Shown in place of the lists while promotions are off. */
function HowItWorks() {
  return (
    <section className={styles.card} aria-labelledby="how-promoters-work">
      <h2 id="how-promoters-work" className={styles.cardTitle}>
        How promoters work
      </h2>
      <ol className={promo.howTo}>
        <li>
          <strong>Set a commission</strong> and turn promotions on. You choose what share of the items a promoter earns.
        </li>
        <li>
          <strong>Invite people you trust</strong>, or let promoters ask to join. Each one gets their own link to your shop.
        </li>
        <li>
          <strong>They earn when a new customer orders</strong> through their link and the order is paid and delivered. Repeat orders are
          all yours.
        </li>
      </ol>
    </section>
  )
}

// ───────────────────────── Settings ─────────────────────────

function SettingsCard({ settings, readOnly }: { settings: PromotionSettings; readOnly: boolean }) {
  const { minRate, maxRate, platformCommissionPercent: platform } = settings
  const [enabled, setEnabled] = useState(settings.promotionsEnabled)
  const [accept, setAccept] = useState(settings.acceptPromoterRequests)
  const [rateText, setRateText] = useState(settings.promoterRate ? String(settings.promoterRate) : '')
  const [saved, setSaved] = useState(false)
  const { pending, error, run } = useAction()

  const rate = Number(rateText)
  const rateValid = Number.isInteger(rate) && rate >= minRate && rate <= maxRate
  const rateError = rateText && !rateValid ? `Enter a whole number from ${minRate} to ${maxRate}.` : enabled && !rateText ? 'Set a commission to turn promotions on.' : null
  const changed = enabled !== settings.promotionsEnabled || accept !== settings.acceptPromoterRequests || (rateValid && rate !== settings.promoterRate)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (rateError) return
    setSaved(false)
    const ok = await run(() =>
      updatePromotionSettings({ promotionsEnabled: enabled, acceptPromoterRequests: accept, ...(rateValid && { promoterRate: rate }) }),
    )
    setSaved(ok)
  }

  return (
    <form className={styles.card} onSubmit={save} noValidate aria-labelledby="promo-settings">
      <h2 id="promo-settings" className={styles.cardTitle}>
        Settings
      </h2>
      <fieldset className={styles.fieldset} disabled={readOnly || pending}>
        <label className={styles.toggleRow}>
          <span className={styles.toggleText}>
            Promotions
            <span className={styles.fieldHint}>Let promoters share my shop</span>
          </span>
          <input className={styles.switch} type="checkbox" role="switch" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        </label>

        <label className={styles.field}>
          Promoter commission (%)
          <input
            className={rateError ? styles.inputInvalid : styles.input}
            inputMode="numeric"
            placeholder="10"
            value={rateText}
            onChange={(e) => setRateText(e.target.value.replace(/[^\d]/g, ''))}
            aria-invalid={Boolean(rateError)}
          />
          {rateError ? (
            <span className={styles.fieldError}>{rateError}</span>
          ) : (
            <span className={styles.fieldHint}>
              From {minRate}% to {maxRate}% of the items (not delivery). You can set a different rate on a product.
            </span>
          )}
        </label>

        {rateValid && (
          <p className={styles.alertInfo}>
            On a GH₵ 100 order through a promoter, you keep <strong>GH₵ {keepsOf100(rate, platform)}</strong>: MarketiX takes {platform}% and
            the promoter gets {rate}%. Promoters only earn on a customer’s first order with you, if it’s paid by MoMo or card and delivered.
          </p>
        )}

        <label className={styles.toggleRow}>
          <span className={styles.toggleText}>
            Let new promoters ask to join
            <span className={styles.fieldHint}>
              {accept
                ? 'Your shop is listed for promoters to find. You approve each one.'
                : 'Your shop is hidden from new promoters. You can still invite people.'}
            </span>
          </span>
          <input className={styles.switch} type="checkbox" role="switch" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        </label>
      </fieldset>

      {!settings.shopLive && settings.promotionsEnabled && (
        <p className={styles.alertWarning}>Promoters will see your shop once it is live on MarketiX.</p>
      )}
      {error && (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      )}
      {saved && !changed && (
        <p className={styles.alertSuccess} role="status">
          Saved.
        </p>
      )}
      {!readOnly && (
        <button className={styles.primary} type="submit" disabled={pending || !changed || Boolean(rateError)}>
          {pending ? 'Saving…' : 'Save settings'}
        </button>
      )}
    </form>
  )
}

// ───────────────────────── Lists ─────────────────────────

type DialogState =
  | { kind: 'invite' }
  | { kind: 'approve'; row: PromoterRow }
  | { kind: 'addLink'; row: PromoterRow }
  | { kind: 'remove'; row: PromoterRow }
  | null

function PromoterLists({ settings, readOnly }: { settings: PromotionSettings; readOnly: boolean }) {
  const result = useAsync(fetchPromoters, { live: true })
  const [dialog, setDialog] = useState<DialogState>(null)
  const close = useCallback(() => setDialog(null), [])

  if (result.status === 'loading') return <p className={styles.centered}>Loading promoters…</p>
  if (result.status === 'error') return <p className={styles.alertError}>{result.error}</p>

  const rows = result.data
  const requests = rows.filter((r) => r.status === 'REQUESTED')
  const approved = rows.filter((r) => r.status === 'APPROVED')
  const invites = rows.filter((r) => r.status === 'INVITED')
  const past = rows.filter((r) => r.status === 'DECLINED' || r.status === 'REMOVED')

  return (
    <>
      {requests.length > 0 && (
        <section className={styles.card} aria-labelledby="requests">
          <h2 id="requests" className={styles.cardTitle}>
            Asking to promote you <Badge tone="warning">{requests.length}</Badge>
          </h2>
          <ul className={promo.list}>
            {requests.map((row) => (
              <RequestItem key={row.id} row={row} readOnly={readOnly} onApprove={() => setDialog({ kind: 'approve', row })} />
            ))}
          </ul>
        </section>
      )}

      <section className={styles.card} aria-labelledby="promoters">
        <div className={promo.cardHead}>
          <h2 id="promoters" className={styles.cardTitle}>
            Your promoters
          </h2>
          {!readOnly && (
            <button className={styles.secondary} type="button" onClick={() => setDialog({ kind: 'invite' })}>
              Invite someone
            </button>
          )}
        </div>
        {approved.length === 0 ? (
          <p className={styles.muted}>
            No promoters yet. Invite people you trust, such as family, friends or loyal customers
            {settings.acceptPromoterRequests ? ', or wait for promoters to ask to join' : ''}.
          </p>
        ) : (
          <ul className={promo.list}>
            {approved.map((row) => (
              <PromoterItem
                key={row.id}
                row={row}
                readOnly={readOnly}
                onAddLink={() => setDialog({ kind: 'addLink', row })}
                onRemove={() => setDialog({ kind: 'remove', row })}
              />
            ))}
          </ul>
        )}
      </section>

      {invites.length > 0 && (
        <section className={styles.card} aria-labelledby="invites">
          <h2 id="invites" className={styles.cardTitle}>
            Invites not accepted yet
          </h2>
          <ul className={promo.list}>
            {invites.map((row) => (
              <InviteItem key={row.id} row={row} readOnly={readOnly} />
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <details className={styles.card}>
          <summary className={promo.summary}>Declined or removed ({past.length})</summary>
          <ul className={promo.list}>
            {past.map((row) => (
              <li key={row.id} className={promo.item}>
                <PersonLine row={row} />
                <span className={styles.fieldHint}>
                  {row.status === 'DECLINED' ? 'Declined' : 'Removed'} {formatDate(row.removedAt ?? row.decidedAt ?? row.requestedAt)}. Invite them
                  again to work with them.
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Sales />

      {dialog?.kind === 'invite' && <InviteDialog onClose={close} />}
      {dialog?.kind === 'approve' && <ApproveDialog row={dialog.row} onClose={close} />}
      {dialog?.kind === 'addLink' && <AddLinkDialog row={dialog.row} onClose={close} />}
      {dialog?.kind === 'remove' && <RemoveDialog row={dialog.row} onClose={close} />}
    </>
  )
}

function PersonLine({ row }: { row: PromoterRow }) {
  const p = row.promoter
  if (!p) return <span className={promo.name}>{formatPhone(row.invite?.phone ?? '', 'local')}</span>
  return (
    <span className={promo.person}>
      <span className={promo.name}>{p.fullName ?? 'Unnamed promoter'}</span>
      <span className={promo.meta}>
        {formatPhone(p.phone, 'local')}
        {p.momoName && ` · MoMo: ${p.momoName}`}{' '}
        {p.momoVerified ? <Badge tone="success">MoMo checked</Badge> : <Badge tone="neutral">MoMo not checked</Badge>}
      </span>
    </span>
  )
}

function StatsLine({ stats }: { stats: NonNullable<PromoterRow['stats']> }) {
  if (stats.buyers === 0) return <span className={promo.stats}>No buyers from their links yet</span>
  return (
    <span className={promo.stats}>
      {plural(stats.buyers, 'buyer')} came · {plural(stats.orders, 'first order')} · {cedis(stats.sales)} sales ·{' '}
      <strong>{cedis(stats.commission)} commission</strong>
    </span>
  )
}

/** Orders credited to promoters: whose link, what it earns, and why not when it doesn't. */
function Sales() {
  const [page, setPage] = useState(1)
  const load = useCallback(() => fetchPromoterSales(page), [page])
  const result = useAsync(load, { live: true })

  return (
    <section className={styles.card} aria-labelledby="promoter-sales">
      <h2 id="promoter-sales" className={styles.cardTitle}>
        Sales from promoters
      </h2>
      <p className={styles.muted}>
        A new customer’s first order through a promoter’s link. Commission is on the items (for a product link, just that product) and only on
        orders paid by MoMo or card and delivered.
      </p>
      {result.status === 'loading' && <p className={styles.muted}>Loading…</p>}
      {result.status === 'error' && <p className={styles.alertError}>{result.error}</p>}
      {result.status === 'success' &&
        (result.data.meta.total === 0 ? (
          <p className={styles.muted}>No orders from promoters yet.</p>
        ) : (
          <>
            <ul className={promo.list}>
              {result.data.data.map((sale) => {
                const state = saleState(sale)
                return (
                  <li key={sale.id} className={promo.item}>
                    <div className={promo.saleHead}>
                      {sale.order ? (
                        <Link className={promo.name} to={`/vendor/orders/${sale.order.id}`}>
                          {sale.order.orderNumber}
                        </Link>
                      ) : (
                        <span className={promo.name}>Order deleted</span>
                      )}
                      <span
                        className={sale.state === 'NO_COMMISSION' ? promo.amountVoid : promo.amount}
                        title={sale.state === 'NO_COMMISSION' ? 'Not paid' : undefined}
                      >
                        {cedis(sale.commissionAmount)}
                      </span>
                    </div>
                    <span className={promo.meta}>
                      {sale.promoter.fullName ?? 'Promoter'} · {sale.link.productName ?? 'Whole shop'} · {sale.ratePercent}% of {cedis(sale.baseAmount)}
                      {sale.order && ` · ${formatDate(sale.order.createdAt)}`}
                    </span>
                    <span>
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </span>
                  </li>
                )
              })}
            </ul>
            <Pagination page={page} pageSize={SALES_PAGE_SIZE} total={result.data.meta.total} onPageChange={setPage} />
          </>
        ))}
    </section>
  )
}

function RequestItem({ row, readOnly, onApprove }: { row: PromoterRow; readOnly: boolean; onApprove: () => void }) {
  const { pending, error, run } = useAction()
  return (
    <li className={promo.item}>
      <PersonLine row={row} />
      <span className={styles.fieldHint}>Asked {formatDate(row.requestedAt)}</span>
      {!readOnly && (
        <div className={promo.actions}>
          <button className={styles.primary} type="button" disabled={pending} onClick={onApprove}>
            Approve
          </button>
          <button className={styles.secondary} type="button" disabled={pending} onClick={() => run(() => declinePromoter(row.id))}>
            {pending ? 'Declining…' : 'Decline'}
          </button>
        </div>
      )}
      {error && <p className={styles.alertError}>{error}</p>}
    </li>
  )
}

function PromoterItem({ row, readOnly, onAddLink, onRemove }: { row: PromoterRow; readOnly: boolean; onAddLink: () => void; onRemove: () => void }) {
  const { pending, error, run } = useAction()
  return (
    <li className={promo.item}>
      <PersonLine row={row} />
      <span className={styles.fieldHint}>
        Promoting since {formatDate(row.decidedAt ?? row.requestedAt)} · {plural(row.links.length, 'link')}
      </span>
      {row.stats && <StatsLine stats={row.stats} />}
      {row.links.length > 0 && (
        <ul className={promo.links}>
          {row.links.map((link) => (
            <li key={link.id}>
              <span>
                {linkLabel(link)} <span className={promo.code}>{link.code}</span>
              </span>
              {!readOnly && (
                <button className={styles.dangerText} type="button" disabled={pending} onClick={() => run(() => removePromoLink(link.id))}>
                  Turn off
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className={promo.actions}>
          <button className={styles.secondary} type="button" onClick={onAddLink}>
            Add a link
          </button>
          <button className={styles.dangerText} type="button" onClick={onRemove}>
            Remove promoter
          </button>
        </div>
      )}
      {error && <p className={styles.alertError}>{error}</p>}
    </li>
  )
}

function InviteItem({ row, readOnly }: { row: PromoterRow; readOnly: boolean }) {
  const { pending, error, run } = useAction()
  const invite = row.invite
  return (
    <li className={promo.item}>
      <PersonLine row={row} />
      <span className={styles.fieldHint}>
        Invited {formatDate(row.requestedAt)} for {invite?.productIds.length ? plural(invite.productIds.length, 'product') : 'the whole shop'}
      </span>
      {invite && <ShareInvite invite={invite} />}
      {!readOnly && (
        <button className={styles.dangerText} type="button" disabled={pending} onClick={() => run(() => cancelInvite(row.id))}>
          {pending ? 'Cancelling…' : 'Cancel invite'}
        </button>
      )}
      {error && <p className={styles.alertError}>{error}</p>}
    </li>
  )
}

/** The invite message with Copy and Send on WhatsApp (to the invited number, from the vendor's own WhatsApp). */
function ShareInvite({ invite }: { invite: NonNullable<PromoterRow['invite']> }) {
  const [copied, setCopied] = useState(false)
  if (!invite.message) {
    return <p className={styles.alertWarning}>Invite links aren’t ready yet: MarketiX still has to set up its WhatsApp number. Please try again later.</p>
  }
  const to = parseGhanaPhone(invite.phone)?.digits ?? ''
  const message = invite.message
  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className={promo.share}>
      <p className={promo.message}>{message}</p>
      <div className={promo.actions}>
        <a className={styles.primary} href={`https://wa.me/${to}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
          Send on WhatsApp
        </a>
        <button className={styles.secondary} type="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy message'}
        </button>
      </div>
    </div>
  )
}

// ───────────────────────── Dialogs ─────────────────────────

/** Whole shop, or a set of products found by search. */
function ScopePicker({ selected, onChange, disabled }: { selected: Product[] | null; onChange: (next: Product[] | null) => void; disabled?: boolean }) {
  const [search, setSearch] = useState('')
  const query = useDebouncedValue(search.trim())
  const load = useCallback(() => fetchProducts(1, query), [query])
  const results = useAsync(load)
  const picking = selected !== null
  const isPicked = (p: Product) => selected?.some((s) => s.id === p.id) ?? false
  const toggle = (p: Product) => onChange(isPicked(p) ? (selected ?? []).filter((s) => s.id !== p.id) : [...(selected ?? []), p])

  return (
    <div className={styles.field} role="group" aria-label="What they can promote">
      What they can promote
      <div className={styles.choices}>
        <label className={styles.choice}>
          <input type="radio" name="scope" checked={!picking} disabled={disabled} onChange={() => onChange(null)} />
          Whole shop
        </label>
        <label className={styles.choice}>
          <input type="radio" name="scope" checked={picking} disabled={disabled} onChange={() => onChange([])} />
          Chosen products
        </label>
      </div>
      {picking && (
        <>
          <input className={styles.input} placeholder="Search your products" value={search} disabled={disabled} onChange={(e) => setSearch(e.target.value)} />
          {results.status === 'error' && <span className={styles.fieldError}>{results.error}</span>}
          <div className={styles.choices}>
            {selected.map((p) => (
              <label key={p.id} className={styles.choice}>
                <input type="checkbox" checked disabled={disabled} onChange={() => toggle(p)} />
                {p.name}
              </label>
            ))}
            {results.status === 'success' &&
              results.data.data
                .filter((p) => !isPicked(p))
                .map((p) => (
                  <label key={p.id} className={styles.choice}>
                    <input type="checkbox" checked={false} disabled={disabled} onChange={() => toggle(p)} />
                    {p.name}
                  </label>
                ))}
          </div>
          <span className={styles.fieldHint}>
            {selected.length ? `${plural(selected.length, 'product')} chosen. Each gets its own link.` : 'Tap products to choose them.'}
          </span>
        </>
      )}
    </div>
  )
}

function ApproveDialog({ row, onClose }: { row: PromoterRow; onClose: () => void }) {
  const [products, setProducts] = useState<Product[] | null>(null)
  const { pending, error, run } = useAction()
  const noneChosen = products !== null && products.length === 0

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (await run(() => approvePromoter(row.id, (products ?? []).map((p) => p.id)), { keepPendingOnSuccess: true })) onClose()
  }

  return (
    <Dialog title={`Approve ${row.promoter?.fullName ?? 'promoter'}`} description="We'll send them their links on WhatsApp straight away." onClose={() => !pending && onClose()}>
      <form className={promo.dialogForm} onSubmit={submit} noValidate>
        <ScopePicker selected={products} onChange={setProducts} disabled={pending} />
        {error && <p className={styles.alertError}>{error}</p>}
        <button className={styles.primary} type="submit" disabled={pending || noneChosen}>
          {pending ? 'Approving…' : 'Approve'}
        </button>
      </form>
    </Dialog>
  )
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState('')
  const [products, setProducts] = useState<Product[] | null>(null)
  const [created, setCreated] = useState<PromoterRow | null>(null)
  const { pending, error, run } = useAction()
  const parsed = parseGhanaPhone(phone)
  const phoneError = phone && !parsed ? 'Enter a Ghana phone number, e.g. 024 411 1222.' : null
  const noneChosen = products !== null && products.length === 0

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!parsed) return
    await run(async () => setCreated(await invitePromoter(parsed.compact, (products ?? []).map((p) => p.id))))
  }

  if (created) {
    return (
      <Dialog title="Invite ready" onClose={onClose}>
        <div className={promo.dialogForm}>
          {created.status === 'APPROVED' ? (
            <p className={styles.alertSuccess}>They had already asked to promote your shop, so they’re approved and have their links.</p>
          ) : (
            <>
              <p className={styles.muted}>Send this to {formatPhone(parsed?.compact ?? '', 'local')} from your WhatsApp. When they tap the link, they join in a few steps.</p>
              {created.invite && <ShareInvite invite={created.invite} />}
            </>
          )}
          <button className={styles.secondary} type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog title="Invite a promoter" description="Only the number you enter can use the invite." onClose={() => !pending && onClose()}>
      <form className={promo.dialogForm} onSubmit={submit} noValidate>
        <label className={styles.field}>
          Their WhatsApp number
          <input
            className={phoneError ? styles.inputInvalid : styles.input}
            inputMode="tel"
            autoComplete="off"
            placeholder="024 411 1222"
            value={phone}
            disabled={pending}
            autoFocus
            onChange={(e) => setPhone(e.target.value)}
          />
          {phoneError && <span className={styles.fieldError}>{phoneError}</span>}
        </label>
        <ScopePicker selected={products} onChange={setProducts} disabled={pending} />
        {error && <p className={styles.alertError}>{error}</p>}
        <button className={styles.primary} type="submit" disabled={pending || !parsed || noneChosen}>
          {pending ? 'Creating…' : 'Create invite'}
        </button>
      </form>
    </Dialog>
  )
}

function AddLinkDialog({ row, onClose }: { row: PromoterRow; onClose: () => void }) {
  const [products, setProducts] = useState<Product[] | null>([])
  const { pending, error, run } = useAction()
  const hasShopLink = row.links.some((l) => l.productId === null)
  const fresh = (products ?? []).filter((p) => !row.links.some((l) => l.productId === p.id))
  const nothingNew = products === null ? hasShopLink : fresh.length === 0

  async function submit(event: FormEvent) {
    event.preventDefault()
    const ok = await run(
      async () => {
        if (products === null) await addPromoLink(row.id)
        else for (const p of fresh) await addPromoLink(row.id, p.id)
      },
      { keepPendingOnSuccess: true },
    )
    if (ok) onClose()
  }

  return (
    <Dialog title={`New link for ${row.promoter?.fullName ?? 'promoter'}`} description="We'll send it to them on WhatsApp." onClose={() => !pending && onClose()}>
      <form className={promo.dialogForm} onSubmit={submit} noValidate>
        <ScopePicker selected={products} onChange={setProducts} disabled={pending} />
        {products === null && hasShopLink && <p className={styles.fieldHint}>They already have a whole-shop link.</p>}
        {error && <p className={styles.alertError}>{error}</p>}
        <button className={styles.primary} type="submit" disabled={pending || nothingNew}>
          {pending ? 'Adding…' : 'Add link'}
        </button>
      </form>
    </Dialog>
  )
}

function RemoveDialog({ row, onClose }: { row: PromoterRow; onClose: () => void }) {
  const { pending, error, run } = useAction()
  return (
    <Dialog
      title={`Remove ${row.promoter?.fullName ?? 'this promoter'}?`}
      description="Their links stop working for new customers. Commission they've already earned is still paid."
      onClose={() => !pending && onClose()}
    >
      <div className={promo.dialogForm}>
        {error && <p className={styles.alertError}>{error}</p>}
        <button
          className={styles.primary}
          type="button"
          disabled={pending}
          onClick={async () => (await run(() => removePromoter(row.id), { keepPendingOnSuccess: true })) && onClose()}
        >
          {pending ? 'Removing…' : 'Remove promoter'}
        </button>
        <button className={styles.secondary} type="button" disabled={pending} onClick={onClose}>
          Keep them
        </button>
      </div>
    </Dialog>
  )
}
