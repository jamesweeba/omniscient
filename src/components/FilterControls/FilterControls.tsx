import type { ReactNode } from 'react'
import styles from './FilterControls.module.css'

interface SearchFieldProps {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

export function SearchField({ label, placeholder, value, onChange }: SearchFieldProps) {
  return (
    <label className={styles.control}>
      <SearchIcon />
      <span className={styles.visuallyHidden}>{label}</span>
      <input
        className={styles.searchInput}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T
  onChange: (value: T) => void
  children: ReactNode
}

/** A labelled <select>; pass <option> elements as children. */
export function SelectField<T extends string>({ label, value, onChange, children }: SelectFieldProps<T>) {
  return (
    <label className={styles.control}>
      <span className={styles.label}>{label}</span>
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {children}
      </select>
    </label>
  )
}

function SearchIcon() {
  return (
    <svg className={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
