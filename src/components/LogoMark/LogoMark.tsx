import styles from './LogoMark.module.css'

/** The green "M" square of the MarketiX logo. `large` for the admin login page. */
export function LogoMark({ large }: { large?: boolean }) {
  return (
    <span className={large ? styles.large : styles.mark} aria-hidden="true">
      M
    </span>
  )
}
