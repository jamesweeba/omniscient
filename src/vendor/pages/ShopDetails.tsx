import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAsync } from '@/hooks/useAsync'
import { DELIVERY_AREAS, DELIVERY_SLOTS, MARKETS, optionId } from '@/lib/locations'
import { parseGhanaPhone } from '@/lib/phone'
import {
  createShop,
  fetchShop,
  isKycLocked,
  isReadOnly,
  updateShop,
  type Shop,
  type ShopInput,
  type TenantStatus,
} from '@/lib/vendorPortal'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import { ShopBannerCard } from './ShopBannerCard'
import { LockNotice, VendorPageHeader } from './VendorPageHeader'

/** Shop details: the create-shop form for new vendors, the settings form afterwards. */
export function ShopDetails() {
  const { shop } = useVendorPortal()
  const [created, setCreated] = useState(false)

  // After creating, wait for the layout's refreshed status before going to the dashboard.
  if (created && shop) return <Navigate to="/vendor" replace />
  if (created) return <p className={styles.centered}>Setting up your shop…</p>
  if (!shop) {
    return (
      <>
        <VendorPageHeader noBack title="Create your shop" lead="Tell us about your shop. You can change most of this later." />
        <ShopForm saved={null} status="PENDING" onCreated={() => setCreated(true)} />
      </>
    )
  }
  return <ExistingShop status={shop.status} />
}

function ExistingShop({ status }: { status: TenantStatus }) {
  const result = useAsync(fetchShop)
  return (
    <>
      <VendorPageHeader title="Shop details" lead="How buyers find you, how you deliver, and where we send your money." />
      <LockNotice status={status} what="your name and MoMo details" />
      <ShopBannerCard status={status} />
      {result.status === 'loading' && <p className={styles.centered}>Loading…</p>}
      {result.status === 'error' && <p className={styles.alertError}>{result.error}</p>}
      {result.status === 'success' && <ShopForm saved={result.data} status={status} />}
    </>
  )
}

const OTHER_MARKET = '__other'
const MAX_DELIVERY_FEE = 500
const MAX_TITLE = 30

type Field = 'name' | 'ownerFullName' | 'ownerPhone' | 'market' | 'fee' | 'momoNumber' | 'momoName' | 'newArea'
type Errors = Partial<Record<Field, string>>

/** Keeps preset options first, then any the vendor saved that aren't presets. */
const withSaved = (presets: string[], saved: string[]) => [...presets, ...saved.filter((title) => !presets.includes(title))]

/** Phones go to the API as "0244111222". */
const phoneForApi = (input: string) => parseGhanaPhone(input)?.local.replace(/\s/g, '') ?? null

interface ShopFormProps {
  saved: Shop | null
  status: TenantStatus
  onCreated?: () => void
}

function ShopForm({ saved, status, onCreated }: ShopFormProps) {
  const navigate = useNavigate()
  const readOnly = isReadOnly(status)
  const kycLocked = isKycLocked(status)

  const savedAreas = saved?.deliveryAreas?.map((a) => a.title) ?? []
  // The API adds an "as soon as possible" slot itself; it isn't one the vendor picks.
  const savedSlots = saved?.deliverySlots?.filter((s) => s.id !== 'asap') ?? []
  const knownMarket = !saved?.market || MARKETS.includes(saved.market)

  const [name, setName] = useState(saved?.name ?? '')
  const [ownerFullName, setOwnerFullName] = useState(saved?.ownerFullName ?? '')
  const [ownerPhone, setOwnerPhone] = useState(saved?.ownerPhone ?? '')
  const [market, setMarket] = useState(saved?.market ? (knownMarket ? saved.market : OTHER_MARKET) : '')
  const [otherMarket, setOtherMarket] = useState(knownMarket ? '' : (saved?.market ?? ''))
  const [stallLocation, setStallLocation] = useState(saved?.stallLocation ?? '')
  const [description, setDescription] = useState(saved?.description ?? '')
  const [fee, setFee] = useState(String(saved?.deliveryFee ?? 10))
  const [areaOptions, setAreaOptions] = useState(() => withSaved(DELIVERY_AREAS, savedAreas))
  const [areas, setAreas] = useState<string[]>(savedAreas)
  const [newArea, setNewArea] = useState('')
  const slotOptions = withSaved(DELIVERY_SLOTS, savedSlots.map((s) => s.title))
  const [slots, setSlots] = useState<string[]>(savedSlots.map((s) => s.title))
  const [pickupNote, setPickupNote] = useState(saved?.pickupNote ?? '')
  const [momoNumber, setMomoNumber] = useState(saved?.momoNumber ?? '')
  const [momoName, setMomoName] = useState(saved?.momoName ?? '')

  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  /** Checks the form and builds the full set of values, or null if something needs fixing. */
  function buildInput(): ShopInput | null {
    const next: Errors = {}
    const phone = phoneForApi(ownerPhone)
    const momo = momoNumber.trim() ? phoneForApi(momoNumber) : ''
    const marketName = market === OTHER_MARKET ? otherMarket.trim() : market
    const deliveryFee = Number(fee)

    if (!name.trim()) next.name = 'Enter your shop name.'
    if (!ownerFullName.trim()) next.ownerFullName = 'Enter your full name as it is on your Ghana Card.'
    if (!phone) next.ownerPhone = 'Enter a Ghana phone number, e.g. 0244111222.'
    if (!marketName) next.market = 'Choose your market.'
    if (fee.trim() === '' || !Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > MAX_DELIVERY_FEE) {
      next.fee = `Enter an amount from 0 to ${MAX_DELIVERY_FEE}.`
    }
    if (momo === null) next.momoNumber = 'Enter a Ghana phone number, e.g. 0244111222.'
    if (momoNumber.trim() && !momoName.trim()) next.momoName = 'Enter the name this MoMo number is registered to.'
    if (!momoNumber.trim() && momoName.trim()) next.momoNumber = 'Enter the MoMo number too.'

    setErrors(next)
    if (Object.keys(next).length || !phone) return null

    return {
      name: name.trim(),
      ownerFullName: ownerFullName.trim(),
      ownerPhone: phone,
      market: marketName,
      stallLocation: stallLocation.trim(),
      description: description.trim(),
      deliveryFee,
      pickupNote: pickupNote.trim(),
      momoNumber: momo || undefined,
      momoName: momoName.trim() || undefined,
      deliveryAreas: areas.map((title) => ({ id: optionId(title), title })),
      deliverySlots: slots.map((title) => {
        const existing = savedSlots.find((s) => s.title === title)
        return existing ?? { id: optionId(title), title }
      }),
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input = buildInput()
    if (!input) {
      setError('Please fix the highlighted fields.')
      return
    }
    setPending(true)
    setError(null)
    try {
      if (saved) {
        const changes = changedFields(saved, input)
        if (Object.keys(changes).length) await updateShop(changes)
        navigate('/vendor')
      } else {
        await createShop(dropEmpty(input))
        onCreated?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPending(false)
    }
  }

  /** Wraps a setter so editing a field also clears its error. */
  const edit =
    <T,>(key: Field, setter: (value: T) => void) =>
    (value: T) => {
      setter(value)
      setErrors((current) => ({ ...current, [key]: undefined }))
      setError(null)
    }

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  function addArea() {
    const title = newArea.trim()
    if (!title) return
    if (title.length > MAX_TITLE) {
      setErrors((current) => ({ ...current, newArea: `Keep it to ${MAX_TITLE} characters.` }))
      return
    }
    const existing = areaOptions.find((a) => optionId(a) === optionId(title))
    if (!existing) setAreaOptions([...areaOptions, title])
    setAreas((current) => (current.includes(existing ?? title) ? current : [...current, existing ?? title]))
    setNewArea('')
  }

  const disabled = readOnly || pending
  const input = (field: Field) => (errors[field] ? styles.inputInvalid : styles.input)

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <fieldset className={styles.fieldset} disabled={disabled}>
        <legend className={styles.legend}>Your shop</legend>
        <Field label="Shop name" hint="What buyers see on WhatsApp." error={errors.name}>
          <input className={input('name')} placeholder="Ama Groceries" value={name} onChange={(e) => edit('name', setName)(e.target.value)} />
        </Field>
        <Field label="Market" error={errors.market}>
          <select className={styles.select} value={market} onChange={(e) => edit('market', setMarket)(e.target.value)}>
            <option value="" disabled>
              Choose your market
            </option>
            {MARKETS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={OTHER_MARKET}>Somewhere else</option>
          </select>
        </Field>
        {market === OTHER_MARKET && (
          <Field label="Which market or town?" error={errors.market}>
            <input className={input('market')} placeholder="e.g. Atonsu, Kumasi" value={otherMarket} onChange={(e) => edit('market', setOtherMarket)(e.target.value)} />
          </Field>
        )}
        <Field label="Stall location" hint="Where riders find you inside the market." optional>
          <input className={styles.input} placeholder="Row C, stall 14" value={stallLocation} onChange={(e) => setStallLocation(e.target.value)} />
        </Field>
        <Field label="About your shop" optional>
          <textarea className={styles.textarea} rows={2} placeholder="Fresh vegetables every morning" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset} disabled={disabled}>
        <legend className={styles.legend}>Owner</legend>
        <Field
          label="Full name"
          hint={kycLocked ? 'Locked while your shop is reviewed or live.' : 'Exactly as it is on your Ghana Card.'}
          error={errors.ownerFullName}
        >
          <input
            className={input('ownerFullName')}
            autoComplete="name"
            placeholder="Ama Serwaa Mensah"
            value={ownerFullName}
            disabled={kycLocked}
            onChange={(e) => edit('ownerFullName', setOwnerFullName)(e.target.value)}
          />
        </Field>
        <Field label="Your phone number" hint="We send review updates and order alerts here. Buyers don’t see it." error={errors.ownerPhone}>
          <input className={input('ownerPhone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="0244111222" value={ownerPhone} onChange={(e) => edit('ownerPhone', setOwnerPhone)(e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset} disabled={disabled}>
        <legend className={styles.legend}>Delivery</legend>
        <Field label="Delivery fee (GH₵)" error={errors.fee}>
          <input className={input('fee')} type="number" inputMode="decimal" min={0} max={MAX_DELIVERY_FEE} value={fee} onChange={(e) => edit('fee', setFee)(e.target.value)} />
        </Field>
        <ChoiceGroup label="Areas you deliver to">
          {areaOptions.map((area) => (
            <Choice key={area} label={area} checked={areas.includes(area)} onChange={() => setAreas(toggle(areas, area))} />
          ))}
        </ChoiceGroup>
        <Field label="Another area" error={errors.newArea} optional>
          <span className={styles.inline}>
            <input
              className={input('newArea')}
              maxLength={MAX_TITLE}
              placeholder="e.g. Atonsu"
              value={newArea}
              onChange={(e) => edit('newArea', setNewArea)(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addArea()
                }
              }}
            />
            <button className={`${styles.secondary} ${styles.small}`} type="button" onClick={addArea}>
              Add
            </button>
          </span>
        </Field>
        <ChoiceGroup label="Delivery times" hint="“As soon as possible” is always offered.">
          {slotOptions.map((slot) => (
            <Choice key={slot} label={slot} checked={slots.includes(slot)} onChange={() => setSlots(toggle(slots, slot))} />
          ))}
        </ChoiceGroup>
        <Field label="Pickup note" hint="Shown to buyers who collect from your stall." optional>
          <input className={styles.input} placeholder="Ready at the stall in 30 minutes" value={pickupNote} onChange={(e) => setPickupNote(e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset} disabled={disabled || kycLocked}>
        <legend className={styles.legend}>MoMo payout</legend>
        <p className={styles.muted}>
          {kycLocked
            ? 'Locked while your shop is reviewed or live. Contact MarketiX support to change it.'
            : 'We pay your sales into this mobile money account. Needed before we can approve your shop.'}
        </p>
        <Field label="MoMo number" error={errors.momoNumber}>
          <input className={input('momoNumber')} type="tel" inputMode="tel" placeholder="0244111222" value={momoNumber} onChange={(e) => edit('momoNumber', setMomoNumber)(e.target.value)} />
        </Field>
        <Field label="Name the MoMo number is registered to" error={errors.momoName}>
          <input className={input('momoName')} placeholder="Ama Serwaa Mensah" value={momoName} onChange={(e) => edit('momoName', setMomoName)(e.target.value)} />
        </Field>
      </fieldset>

      {error && (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      )}
      {!readOnly && (
        <button className={styles.primary} type="submit" disabled={pending}>
          {pending ? 'Saving…' : saved ? 'Save changes' : 'Create my shop'}
        </button>
      )}
    </form>
  )
}

/** Only what differs from the saved shop, so unchanged (possibly locked) KYC fields aren't sent. */
function changedFields(saved: Shop, input: ShopInput): Partial<ShopInput> {
  const before: ShopInput = {
    name: saved.name,
    ownerFullName: saved.ownerFullName,
    ownerPhone: saved.ownerPhone,
    market: saved.market ?? '',
    stallLocation: saved.stallLocation ?? '',
    description: saved.description ?? '',
    deliveryFee: saved.deliveryFee,
    pickupNote: saved.pickupNote ?? '',
    momoNumber: saved.momoNumber ?? undefined,
    momoName: saved.momoName ?? undefined,
    deliveryAreas: saved.deliveryAreas ?? [],
    deliverySlots: saved.deliverySlots?.filter((s) => s.id !== 'asap') ?? [],
  }
  const changes: Partial<Record<keyof ShopInput, unknown>> = {}
  for (const key of Object.keys(input) as (keyof ShopInput)[]) {
    if (input[key] !== undefined && JSON.stringify(input[key]) !== JSON.stringify(before[key])) changes[key] = input[key]
  }
  return changes as Partial<ShopInput>
}

/** For a new shop: leave out optional fields the vendor didn't fill in. */
function dropEmpty(input: ShopInput): ShopInput {
  const entries = Object.entries(input).filter(([, value]) => value !== '' && value !== undefined && !(Array.isArray(value) && value.length === 0))
  return Object.fromEntries(entries) as unknown as ShopInput
}

function Field({ label, hint, error, optional, children }: { label: string; hint?: string; error?: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>
        {label}
        {optional && <span className={styles.optional}> · optional</span>}
      </span>
      {children}
      {error ? <span className={styles.fieldError}>{error}</span> : hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  )
}

function ChoiceGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field} role="group" aria-label={label}>
      {label}
      <div className={styles.choices}>{children}</div>
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </div>
  )
}

function Choice({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={styles.choice}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  )
}
