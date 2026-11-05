import styles from './LogoMark.module.css'

/** The green "M" square of the MarketiX logo. `large` for the login and sign-up pages. */
export function LogoMark({ large, glow }: { large?: boolean; glow?: boolean }) {
  return (
    <span className={`${large ? styles.large : styles.mark} ${glow ? styles.glow : ''}`} aria-hidden="true">
      M
    </span>
  )
}
