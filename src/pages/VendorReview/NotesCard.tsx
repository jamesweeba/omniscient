import { useCallback, useId, useState, type FormEvent } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import {
  addVendorNote,
  deleteVendorNote,
  editVendorNote,
  fetchVendorNotes,
  MAX_NOTE_LENGTH,
  type VendorDetail,
  type VendorNote,
} from '@/lib/vendors'
import styles from './VendorReview.module.css'

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.')

/** Admins' private notes on the shop: calls made, promises, follow-ups. The vendor never sees them. */
export function NotesCard({ vendor }: { vendor: VendorDetail }) {
  const load = useCallback(() => fetchVendorNotes(vendor.id), [vendor.id])
  const notes = useAsync(load)
  const count = notes.status === 'success' ? notes.data.length : null

  return (
    <section className={styles.card} aria-labelledby="notes">
      <div className={styles.cardHeader}>
        <h2 id="notes" className={styles.cardTitle}>
          Notes{count ? ` · ${count}` : ''}
        </h2>
        <span className={styles.mutedText}>Only admins see these</span>
      </div>

      <NoteForm
        submitLabel="Add note"
        placeholder="e.g. Called Ama. She'll upload a clearer Ghana Card photo tomorrow."
        onSubmit={async (body) => {
          await addVendorNote(vendor.id, body)
          notes.reload()
        }}
      />

      {notes.status === 'loading' && <p className={styles.mutedText}>Loading notes…</p>}
      {notes.status === 'error' && <p className={styles.errorText}>{notes.error}</p>}
      {notes.status === 'success' &&
        (notes.data.length === 0 ? (
          <p className={styles.mutedText}>No notes yet.</p>
        ) : (
          <ol className={styles.noteList} aria-busy={notes.isFetching}>
            {notes.data.map((note) => (
              <NoteItem key={note.id} vendorId={vendor.id} note={note} onChanged={notes.reload} />
            ))}
          </ol>
        ))}
    </section>
  )
}

interface NoteFormProps {
  initial?: string
  submitLabel: string
  placeholder?: string
  /** Throw to keep the form open and show the error. */
  onSubmit: (body: string) => Promise<void>
  onCancel?: () => void
}

function NoteForm({ initial = '', submitLabel, placeholder, onSubmit, onCancel }: NoteFormProps) {
  const id = useId()
  const [body, setBody] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = body.trim()
  const tooLong = body.length > MAX_NOTE_LENGTH

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!trimmed || tooLong) return
    setPending(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      if (!onCancel) setBody('')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className={styles.noteForm} onSubmit={submit}>
      <label className={styles.visuallyHidden} htmlFor={id}>
        {submitLabel === 'Add note' ? 'New note' : 'Edit note'}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        rows={onCancel ? 3 : 2}
        placeholder={placeholder}
        value={body}
        disabled={pending}
        autoFocus={Boolean(onCancel)}
        onChange={(e) => {
          setBody(e.target.value)
          setError(null)
        }}
      />
      <div className={styles.noteFormFooter}>
        <span className={tooLong ? styles.noteCountOver : styles.noteCount} aria-live="polite">
          {body.length > MAX_NOTE_LENGTH - 200 && `${body.length} / ${MAX_NOTE_LENGTH}`}
        </span>
        <div className={styles.noteFormButtons}>
          {onCancel && (
            <button className={styles.secondaryButton} type="button" disabled={pending} onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className={styles.secondaryButton} type="submit" disabled={pending || !trimmed || tooLong}>
            {pending ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

interface NoteItemProps {
  vendorId: string
  note: VendorNote
  onChanged: () => void
}

function NoteItem({ vendorId, note, onChanged }: NoteItemProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmDelete'>('view')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** A 404 means someone already deleted it: just refresh the list. */
  function handleError(err: unknown) {
    if (err instanceof ApiError && err.status === 404) onChanged()
    else setError(errorText(err))
  }

  async function remove() {
    setPending(true)
    setError(null)
    try {
      await deleteVendorNote(vendorId, note.id)
      onChanged()
    } catch (err) {
      handleError(err)
      setPending(false)
    }
  }

  return (
    <li className={styles.noteItem}>
      <div className={styles.noteMeta}>
        <strong>{note.author.name}</strong>
        <span>
          {formatDateTime(note.createdAt)}
          {note.editedAt && <span title={`Edited ${formatDateTime(note.editedAt)}`}> · edited</span>}
        </span>
      </div>

      {mode === 'edit' ? (
        <NoteForm
          initial={note.body}
          submitLabel="Save"
          onCancel={() => setMode('view')}
          onSubmit={async (body) => {
            try {
              await editVendorNote(vendorId, note.id, body)
              setMode('view')
              onChanged()
            } catch (err) {
              if (err instanceof ApiError && err.status === 404) return handleError(err)
              throw err
            }
          }}
        />
      ) : (
        <p className={styles.noteBody}>{note.body}</p>
      )}

      {note.mine && mode === 'view' && (
        <div className={styles.noteActions}>
          <button className={styles.linkButton} type="button" onClick={() => setMode('edit')}>
            Edit
          </button>
          <button className={styles.linkButtonDanger} type="button" onClick={() => setMode('confirmDelete')}>
            Delete
          </button>
        </div>
      )}

      {mode === 'confirmDelete' && (
        <div className={styles.noteActions} role="group" aria-label="Confirm delete">
          <span>Delete this note?</span>
          <button className={styles.linkButtonDanger} type="button" disabled={pending} onClick={remove}>
            {pending ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button className={styles.linkButton} type="button" disabled={pending} onClick={() => setMode('view')}>
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </li>
  )
}
