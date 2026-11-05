import type { AsyncState } from '@/hooks/useAsync'
import { formatMessagingLimit, NUMBER_QUALITY } from '@/lib/numberDisplay'
import type { PoolNumber } from '@/lib/numbers'
import { formatPhone } from '@/lib/phone'
import styles from './VendorReview.module.css'

/** "Next free number" lets the backend pick. */
export const NEXT_FREE = ''

interface NumberPickerProps {
  /** Free numbers, as loaded by useAsync(fetchFreeNumbers). */
  numbers: AsyncState<PoolNumber[]>
  /** A number id, or NEXT_FREE. */
  selected: string
  onSelect: (id: string) => void
  displayName: string
  onDisplayNameChange: (name: string) => void
  disabled?: boolean
  /** id of the heading that labels the radio group. */
  labelledBy: string
}

/** Radio list: "Next free number" plus each free number with its quality; then the display name. */
export function NumberPicker({ numbers, selected, onSelect, displayName, onDisplayNameChange, disabled, labelledBy }: NumberPickerProps) {
  const free = numbers.status === 'success' ? numbers.data : []

  return (
    <>
      {numbers.status === 'loading' && <p className={styles.mutedText}>Loading free numbers…</p>}
      {numbers.status === 'error' && <p className={styles.errorText}>{numbers.error}</p>}
      {numbers.status === 'success' && free.length === 0 && (
        <p className={styles.errorText}>No free numbers left. Add one in the number pool before approving.</p>
      )}

      {free.length > 0 && (
        <div className={styles.options} role="radiogroup" aria-labelledby={labelledBy}>
          <Option name={labelledBy} checked={selected === NEXT_FREE} disabled={disabled} onSelect={() => onSelect(NEXT_FREE)}
            title="Next free number" hint={`Currently ${formatPhone(free[0].phone)}`} />
          {free.map((number) => (
            <Option
              key={number.id}
              name={labelledBy}
              checked={selected === number.id}
              disabled={disabled}
              onSelect={() => onSelect(number.id)}
              title={formatPhone(number.phone)}
              hint={[`Quality ${NUMBER_QUALITY[number.quality].toLowerCase()}`, formatMessagingLimit(number.messagingLimit)]
                .filter((part) => part !== '—')
                .join(' · ')}
            />
          ))}
        </div>
      )}

      <label className={styles.formField}>
        <span className={styles.formLabel}>WhatsApp display name</span>
        <input
          className={styles.input}
          type="text"
          value={displayName}
          disabled={disabled}
          onChange={(e) => onDisplayNameChange(e.target.value)}
        />
        <span className={styles.optionHint}>Not sent to Meta automatically: submit it in WhatsApp Manager after approving.</span>
      </label>
    </>
  )
}

interface OptionProps {
  name: string
  checked: boolean
  disabled?: boolean
  onSelect: () => void
  title: string
  hint: string
}

function Option({ name, checked, disabled, onSelect, title, hint }: OptionProps) {
  return (
    <label className={checked ? styles.optionSelected : styles.option}>
      <input className={styles.optionInput} type="radio" name={`${name}-number`} checked={checked} disabled={disabled} onChange={onSelect} />
      <span className={styles.optionText}>
        <span className={styles.optionTitle}>{title}</span>
        <span className={styles.optionHint}>{hint}</span>
      </span>
    </label>
  )
}
