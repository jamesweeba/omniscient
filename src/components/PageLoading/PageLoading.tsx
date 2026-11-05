import styles from './PageLoading.module.css'

/**
 * Shown while a page's code downloads. It fades in after a moment, so on a fast
 * connection it never flashes up.
 */
export function PageLoading({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div className={fullPage ? styles.fullPage : styles.inline} role="status" aria-live="polite">
      <span className={styles.text}>Loading…</span>
    </div>
  )
}
