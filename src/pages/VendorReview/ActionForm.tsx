import { useId, useState } from 'react'
import styles from './VendorReview.module.css'

interface ActionFormProps {
  label: string
  placeholder: string
  /** Require a note before submitting (e.g. the reason for a suspension). */
  required?: boolean
  submitLabel: string
  pendingLabel: string
  variant: 'primary' | 'secondary' | 'danger'
  /** Asked with window.confirm before submitting, if set. */
  confirmMessage?: string
  onSubmit: (note: string) => Promise<void>
}

/** A note field plus one action button, with validation, confirmation and error display. */
export function ActionForm({
  label,
  placeholder,
  required = false,
  submitLabel,
  pendingLabel,
  variant,
  confirmMessage,
  onSubmit,
}: ActionFormProps) {
  const id = useId()
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const trimmed = note.trim()
    if (required && !trimmed) {
      setError('Add a reason first. It is saved to the audit log.')
      return
    }
    if (confirmMessage && !window.confirm(confirmMessage)) return

    setPending(true)
    setError(null)
    try {
      await onSubmit(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPending(false)
    }
  }

  const buttonClass = {
    primary: styles.primaryButton,
    secondary: styles.secondaryButton,
    danger: styles.dangerButton,
  }[variant]

  return (
    <>
      <div className={styles.formField}>
        <label className={styles.formLabel} htmlFor={id}>
          {label}{' '}
          <span className={styles.formLabelHint}>{required ? '(required)' : '(optional)'}</span>
        </label>
        <textarea
          id={id}
          className={styles.textarea}
          rows={3}
          placeholder={placeholder}
          value={note}
          disabled={pending}
          onChange={(e) => {
            setNote(e.target.value)
            setError(null)
          }}
        />
      </div>

      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}

      <button className={buttonClass} type="button" disabled={pending} onClick={handleSubmit}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </>
  )
}
