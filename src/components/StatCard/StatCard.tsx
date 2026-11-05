import type { ReactNode } from 'react'
import styles from './StatCard.module.css'

export type StatTone = 'muted' | 'warning' | 'success'

interface StatCardProps {
  label: string
  value: number | string
  /** Colours the value orange. */
  valueTone?: 'warning'
  note?: string
  noteTone?: StatTone
  /** Draws an orange border to call attention to the card. */
  highlighted?: boolean
}

export function StatCard({ label, value, valueTone, note, noteTone = 'muted', highlighted }: StatCardProps) {
  return (
    <div className={highlighted ? styles.cardHighlighted : styles.card}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${valueTone ? styles[valueTone] : ''}`}>{value}</span>
      {note && <span className={`${styles.note} ${styles[noteTone]}`}>{note}</span>}
    </div>
  )
}

/** Responsive grid of StatCards: 4 across, 2 on tablets, 1 on phones. */
export function StatGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={styles.grid} aria-label={label}>
      {children}
    </section>
  )
}
