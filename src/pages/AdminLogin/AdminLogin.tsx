import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { Credentials } from '@/lib/auth'
import styles from './AdminLogin.module.css'

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

interface AdminLoginProps {
  /** Resolves on success; rejects with an Error whose message is shown to the user. */
  onLogin: (credentials: Credentials) => Promise<void>
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await onLogin({ email, password })
    } catch (err) {
      setError(err instanceof Error ? err.message : FALLBACK_ERROR)
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <aside className={styles.brand}>
        <div className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true">
            M
          </span>
          MarketiX
        </div>

        <div className={styles.pitch}>
          <h1 className={styles.headline}>Market vendors, selling on WhatsApp.</h1>
          <p className={styles.tagline}>
            Review new shops, check their documents, and hand each one a WhatsApp
            number buyers can order from.
          </p>
        </div>

        <p className={styles.footnote}>
          Staff access only. Vendors log in at the <Link to="/vendor/login">vendor app</Link>.
        </p>
      </aside>

      <main className={styles.main}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.header}>
            <h2 className={styles.title}>Log in</h2>
            <p className={styles.subtitle}>Super admin account</p>
          </div>

          <label className={styles.field}>
            Email
            <input
              className={styles.input}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="esi@marketix.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            Password
            <input
              className={styles.input}
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <div className={styles.error} role="alert">
              <ErrorIcon />
              <span>{error}</span>
            </div>
          )}

          <button className={styles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>

          <p className={styles.help}>Forgot your password? Contact support.</p>
        </form>
      </main>
    </div>
  )
}

function ErrorIcon() {
  return (
    <svg
      className={styles.errorIcon}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4m0 4h.01" />
    </svg>
  )
}
