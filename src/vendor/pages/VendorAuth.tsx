import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { LogoMark } from '@/components/LogoMark/LogoMark'
import { useAuth } from '@/context/auth-context'
import { useAction } from '@/hooks/useAction'
import { usePageTitle } from '@/hooks/usePageTitle'
import { canUseArea } from '@/lib/auth'
import { OrderFlowDemo } from './OrderFlowDemo'
import styles from './VendorAuth.module.css'

type Mode = 'signup' | 'login'

const MIN_PASSWORD = 8
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const YEAR = new Date().getFullYear()

type Field = 'firstName' | 'lastName' | 'email' | 'password'

/** Vendor sign-up and log-in (one screen, two tabs; each tab has its own URL). */
export function VendorAuth({ mode }: { mode: Mode }) {
  usePageTitle(mode === 'signup' ? 'Sign up' : 'Log in')
  const { session, login, signup } = useAuth()
  const from = (useLocation().state as { from?: string } | null)?.from

  const [values, setValues] = useState<Record<Field, string>>({ firstName: '', lastName: '', email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  const { pending, error, setError, run } = useAction()

  if (session && canUseArea(session.user.role, 'vendor')) return <Navigate to={from ?? '/vendor'} replace />

  const isSignup = mode === 'signup'
  const set = (field: Field) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function validate(): boolean {
    const errors: Partial<Record<Field, string>> = {}
    if (isSignup && !values.firstName.trim()) errors.firstName = 'Enter your first name.'
    if (isSignup && !values.lastName.trim()) errors.lastName = 'Enter your last name.'
    if (!EMAIL.test(values.email.trim())) errors.email = 'Enter a valid email address.'
    if (isSignup && values.password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters.`
    if (!isSignup && !values.password) errors.password = 'Enter your password.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return

    const email = values.email.trim()
    // The redirect above runs once the session is set.
    await run(
      () =>
        isSignup
          ? signup({ firstName: values.firstName.trim(), lastName: values.lastName.trim(), email, password: values.password })
          : login({ email, password: values.password }, 'vendor'),
      { keepPendingOnSuccess: true },
    )
  }

  const switchTo = isSignup
    ? { prompt: 'Already selling with us?', label: 'Log in', to: '/vendor/login' }
    : { prompt: 'New to MarketiX?', label: 'Open a shop', to: '/vendor/signup' }

  return (
    <div className={styles.page} data-mode={mode}>
      <main className={styles.panel}>
        <div className={styles.brand}>
          <LogoMark />
          MarketiX
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <header className={styles.formHeading}>
            <h1 className={styles.formTitle}>{isSignup ? 'Open your shop' : 'Log in to your shop'}</h1>
            <p className={styles.switch}>
              {switchTo.prompt}{' '}
              <Link
                to={switchTo.to}
                replace
                state={{ from }}
                onClick={() => {
                  setError(null)
                  setFieldErrors({})
                }}
              >
                {switchTo.label}
              </Link>
            </p>
          </header>

          {isSignup && (
            <div className={styles.names}>
              <TextField label="First name" autoComplete="given-name" value={values.firstName} error={fieldErrors.firstName} onChange={set('firstName')} />
              <TextField label="Last name" autoComplete="family-name" value={values.lastName} error={fieldErrors.lastName} onChange={set('lastName')} />
            </div>
          )}
          <TextField label="Email" type="email" autoComplete="email" value={values.email} error={fieldErrors.email} onChange={set('email')} />
          <TextField
            label="Password"
            type="password"
            hint={isSignup ? `At least ${MIN_PASSWORD} characters.` : undefined}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={values.password}
            error={fieldErrors.password}
            onChange={set('password')}
          />

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button className={styles.submit} type="submit" disabled={pending}>
            {pending && <span className={styles.spinner} aria-hidden="true" />}
            {pending ? (isSignup ? 'Creating your account…' : 'Logging in…') : isSignup ? 'Create account' : 'Log in'}
          </button>

          {!isSignup && (
            <p className={styles.help}>
              Forgot your password? Call us on <a href="tel:0200000000">020 000 0000</a>.
            </p>
          )}
        </form>

        <footer className={styles.footer}>
          <span>© {YEAR} MarketiX</span>
          <Link to="/login">Staff log in</Link>
        </footer>
      </main>

      <aside className={styles.showcase} aria-label="How MarketiX works">
        <div className={styles.story}>
          <h2 className={styles.headline}>Sell your goods on WhatsApp.</h2>
          <ol className={styles.steps}>
            <li>
              <span className={styles.stepNumber}>01</span>
              <span>
                <strong>Your own number.</strong> We give your shop a WhatsApp number buyers can message.
              </span>
            </li>
            <li>
              <span className={styles.stepNumber}>02</span>
              <span>
                <strong>Orders in the chat.</strong> Buyers pick products and delivery in a WhatsApp form.
              </span>
            </li>
            <li>
              <span className={styles.stepNumber}>03</span>
              <span>
                <strong>Paid to your MoMo.</strong> We collect the money and send it to you.
              </span>
            </li>
          </ol>
        </div>
        <div className={styles.demo}>
          <OrderFlowDemo />
        </div>
      </aside>
    </div>
  )
}

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: 'text' | 'email' | 'password'
  /** Shown under the input until there's an error. */
  hint?: string
  autoComplete?: string
}

function TextField({ label, value, onChange, error, type = 'text', hint, autoComplete }: TextFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        {label}
        <input
          className={error ? styles.inputInvalid : styles.input}
          type={isPassword && revealed ? 'text' : type}
          autoComplete={autoComplete}
          value={value}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {isPassword && (
        <button
          className={styles.reveal}
          type="button"
          aria-pressed={revealed}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          onClick={() => setRevealed(!revealed)}
        >
          {revealed ? 'Hide' : 'Show'}
        </button>
      )}
      {error ? <span className={styles.fieldError}>{error}</span> : hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
