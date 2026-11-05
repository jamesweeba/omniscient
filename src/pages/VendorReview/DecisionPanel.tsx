import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAsync } from '@/hooks/useAsync'
import { CHECKLIST } from '@/lib/checklist'
import { fetchFreeNumbers } from '@/lib/numbers'
import { formatPhone } from '@/lib/phone'
import { conflictNotice, errorMessage, isConflict } from '@/lib/api'
import { approveVendor, saveChecks, sendBack, type ChecklistKey, type VendorDetail } from '@/lib/vendors'
import { NEXT_FREE, NumberPicker } from './NumberPicker'
import type { OnChanged } from './refreshOnConflict'
import styles from './VendorReview.module.css'

type Decision = 'approve' | 'moreInfo' | 'reject'

interface DecisionPanelProps {
  vendor: VendorDetail
  /** Called after a decision (or a 409), with a message; the page reloads the shop. */
  onChanged: OnChanged
}

const NO_NUMBERS = /no free whatsapp numbers/i
const NUMBER_TAKEN = /not free any more/i

/** Due-diligence checklist, number assignment and the decision, for a shop waiting for review. */
export function DecisionPanel({ vendor, onChanged }: DecisionPanelProps) {
  const numbers = useAsync(fetchFreeNumbers)
  // The number pool links here with ?number=<id> to preselect a number.
  const [searchParams] = useSearchParams()

  const [checks, setChecks] = useState(vendor.checks)
  const [checksError, setChecksError] = useState<string | null>(null)
  const [numberId, setNumberId] = useState(searchParams.get('number') ?? NEXT_FREE)
  const [displayName, setDisplayName] = useState(vendor.shopName)
  const [notes, setNotes] = useState('')
  const [pending, setPending] = useState<Decision | null>(null)
  const [error, setError] = useState<string | null>(null)

  const free = numbers.status === 'success' ? numbers.data : []
  // A preselected number that has since been taken falls back to "next free", with a warning.
  const selected = free.some((n) => n.id === numberId) ? numberId : NEXT_FREE
  const preselectedGone = numbers.status === 'success' && numberId !== NEXT_FREE && selected === NEXT_FREE
  const assigning = free.find((n) => n.id === selected) ?? free[0]

  const doneCount = CHECKLIST.filter(({ key }) => checks[key]).length
  const allChecked = doneCount === CHECKLIST.length
  const locked = pending !== null
  const canApprove = allChecked && free.length > 0 && displayName.trim() !== '' && !locked

  async function toggleCheck(key: ChecklistKey) {
    const value = !checks[key]
    setChecks((current) => ({ ...current, [key]: value }))
    setChecksError(null)
    try {
      await saveChecks(vendor.id, { [key]: value })
    } catch (err) {
      // The shop changed under us (e.g. someone else decided): reload it.
      if (isConflict(err)) return onChanged(conflictNotice(err.message), 'warning')
      setChecks((current) => ({ ...current, [key]: !value }))
      setChecksError(errorMessage(err, 'Couldn’t save that tick. Try again.'))
    }
  }

  async function decide(decision: Decision) {
    const note = notes.trim()
    if (decision !== 'approve' && !note) {
      setError('Add a note so the vendor knows what to fix. They see it.')
      return
    }
    if (decision === 'reject' && !window.confirm(`Reject ${vendor.shopName}? The vendor sees your note and can resubmit.`)) return

    setPending(decision)
    setError(null)
    try {
      if (decision === 'approve') {
        const number = await approveVendor(vendor.id, {
          numberId: selected || undefined,
          displayName: displayName.trim(),
          // Sent too, so a tick still being saved can't make approval fail.
          checks,
          notes: note,
        })
        onChanged(
          `Approved. ${formatPhone(number.phone)} is assigned and the shop is live. Remember to submit the display name “${displayName.trim()}” in WhatsApp Manager.`,
        )
      } else if (decision === 'moreInfo') {
        await sendBack(vendor.id, 'MORE_INFO', note)
        onChanged('Sent back for more info. The shop returns to the queue when the vendor resubmits.')
      } else {
        await sendBack(vendor.id, 'REJECTED', note)
        onChanged('Rejected. The vendor sees your note and can resubmit.')
      }
    } catch (err) {
      const message = errorMessage(err)
      // These two 409s are about the number, not the shop: handle them here.
      if (NUMBER_TAKEN.test(message)) numbers.reload()
      else if (isConflict(err) && !NO_NUMBERS.test(message)) return onChanged(conflictNotice(message), 'warning')
      setError(message)
      setPending(null)
    }
  }

  return (
    <aside className={styles.sideColumn} aria-label="Decision">
      <section className={styles.card} aria-labelledby="checklist">
        <div className={styles.cardIntro}>
          <h2 id="checklist" className={styles.cardTitle}>
            Due-diligence checklist
          </h2>
          <p className={styles.mutedText}>All four are needed to approve. Each tick is saved and logged as you go.</p>
        </div>

        <div className={styles.options}>
          {CHECKLIST.map(({ key, title, hint }) => (
            <label key={key} className={checks[key] ? styles.optionSelected : styles.option}>
              <input className={styles.optionInput} type="checkbox" checked={checks[key]} disabled={locked} onChange={() => toggleCheck(key)} />
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>{title}</span>
                <span className={styles.optionHint}>{hint}</span>
              </span>
            </label>
          ))}
        </div>

        <p className={allChecked ? styles.progressDone : styles.progressPending}>
          {allChecked ? 'All checks complete' : `${doneCount} of ${CHECKLIST.length} checks complete`}
        </p>
        {checksError && <p className={styles.errorText}>{checksError}</p>}
      </section>

      <section className={styles.card} aria-labelledby="number">
        <h2 id="number" className={styles.cardTitle}>
          WhatsApp number to assign
        </h2>
        <NumberPicker
          numbers={numbers}
          selected={selected}
          onSelect={setNumberId}
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          disabled={locked}
          labelledBy="number"
        />
        {preselectedGone && (
          <p className={styles.errorText} role="alert">
            The number you picked in the pool is no longer free. Choose another, or use the next free number.
          </p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="decision">
        <h2 id="decision" className={styles.cardTitle}>
          Decision
        </h2>

        <label className={styles.formField}>
          <span className={styles.formLabel}>
            Notes <span className={styles.formLabelHint}>(required for More info and Reject; the vendor sees them)</span>
          </span>
          <textarea
            className={styles.textarea}
            rows={3}
            placeholder="e.g. Your Ghana Card photo is blurry. Please upload a clearer one."
            value={notes}
            disabled={locked}
            onChange={(e) => {
              setNotes(e.target.value)
              setError(null)
            }}
          />
        </label>

        {error && (
          <p className={styles.errorText} role="alert">
            {error}
            {NO_NUMBERS.test(error) && (
              <>
                {' '}
                <Link to="/whatsapp-numbers">Go to the number pool</Link>
              </>
            )}
          </p>
        )}
        <div className={styles.decisionButtons}>
          <button className={styles.primaryButton} type="button" disabled={!canApprove} onClick={() => decide('approve')}>
            {pending === 'approve'
              ? 'Approving…'
              : !allChecked
                ? 'Approve (complete the checklist first)'
                : assigning
                  ? `Approve and assign ${formatPhone(assigning.phone)}`
                  : 'Approve (no free number)'}
          </button>
          <div className={styles.buttonPair}>
            <button className={styles.secondaryButton} type="button" disabled={locked} onClick={() => decide('moreInfo')}>
              {pending === 'moreInfo' ? 'Sending…' : 'Request more info'}
            </button>
            <button className={styles.dangerButton} type="button" disabled={locked} onClick={() => decide('reject')}>
              {pending === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </section>
    </aside>
  )
}
