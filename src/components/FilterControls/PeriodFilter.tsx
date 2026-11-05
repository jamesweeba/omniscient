import { useState } from 'react'
import { DEFAULT_PERIOD, ORDER_PERIODS } from '@/lib/orderDisplay'
import type { OrderPeriod, PeriodQuery } from '@/lib/orders'
import { SelectField } from './FilterControls'
import styles from './FilterControls.module.css'

const CUSTOM = 'custom'

interface PeriodFilterProps {
  value: PeriodQuery
  /** URL changes: `period`, `from` and `to` (null removes one). */
  onChange: (changes: Record<'period' | 'from' | 'to', string | null>) => void
}

/** Preset periods, or "Custom dates" with from/to (whole days, both inclusive). */
export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const hasDates = Boolean(value.from || value.to)
  const [custom, setCustom] = useState(hasDates)
  const showDates = custom || hasDates

  return (
    <>
      <SelectField<OrderPeriod | typeof CUSTOM>
        label="Period"
        value={showDates ? CUSTOM : value.period}
        onChange={(next) => {
          if (next === CUSTOM) return setCustom(true)
          setCustom(false)
          onChange({ period: next === DEFAULT_PERIOD ? null : next, from: null, to: null })
        }}
      >
        {ORDER_PERIODS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={CUSTOM}>Custom dates…</option>
      </SelectField>
      {showDates && (
        <>
          <label className={styles.control}>
            <span className={styles.label}>From</span>
            <input
              className={styles.dateInput}
              type="date"
              value={value.from ?? ''}
              max={value.to}
              onChange={(e) => onChange({ period: null, from: e.target.value || null, to: value.to ?? null })}
            />
          </label>
          <label className={styles.control}>
            <span className={styles.label}>To</span>
            <input
              className={styles.dateInput}
              type="date"
              value={value.to ?? ''}
              min={value.from}
              onChange={(e) => onChange({ period: null, from: value.from ?? null, to: e.target.value || null })}
            />
          </label>
        </>
      )}
    </>
  )
}
