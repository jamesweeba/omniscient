import type { ReactNode } from 'react'
import styles from './Badge.module.css'

export type BadgeTone = 'success' | 'warning' | 'neutral' | 'danger' | 'info'

/** How a status is shown: its words and its badge colour. */
export interface StatusDisplay {
  label: string
  tone: BadgeTone
}

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}
