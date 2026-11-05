import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './BackLink.module.css'

/** "‹ Orders": the link back to the page above, at the top of a page. */
export function BackLink({ to, small, children }: { to: string; small?: boolean; children: ReactNode }) {
  return (
    <Link className={small ? styles.small : styles.link} to={to}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {children}
    </Link>
  )
}
