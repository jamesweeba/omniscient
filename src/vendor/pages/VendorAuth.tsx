import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
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

type Field = 'firstName' | 'lastName' | 'email' | 'password'

/** Vendor sign-up and log-in (one screen, two tabs; each tab has its own URL). */
export function VendorAuth({ mode }: { mode: Mode }) {
  usePageTitle(mode === 'signup' ? 'Sign up' : 'Log in')
  const { session, login, signup } = useAuth()
  const navigate = useNavigate()
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

  return (
    <div className={styles.page} data-mode={mode}>
      <section className={styles.hero}>
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.brand}>
            <LogoMark large glow />
            MarketiX
          </div>

          <div className={styles.pitch}>
            <h1 className={styles.headline}>
              Sell your goods on <span className={styles.highlight}>WhatsApp</span>
            </h1>
            <p className={styles.tagline}>
              Buyers order from you on WhatsApp. You get a number and we handle the rest.
            </p>
          </div>

          <div className={styles.showcase}>
            <OrderFlowDemo />
          </div>

          <ul className={styles.benefits}>
            <li>
              <BenefitIcon path="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
              Your own WhatsApp number
            </li>
            <li>
              <BenefitIcon path="M4 5h16v11H8l-4 4zM8 10h8M8 13h5" />
              Buyers order with a WhatsApp form
            </li>
            <li>
              <BenefitIcon path="M3 7h18v10H3zM3 11h18M7 15h3" />
              Paid to your MoMo
            </li>
          </ul>
        </div>
      </section>

      <section className={styles.panel}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.formHeading}>
            <h2 className={styles.formTitle}>{isSignup ? 'Open your shop' : 'Welcome back'}</h2>
            <p className={styles.formLead}>
              {isSignup ? 'Set up your shop in three short steps.' : 'Log in to manage your shop and orders.'}
            </p>
          </div>

          <div className={styles.tabs} data-mode={mode} role="tablist" aria-label="Sign up or log in">
            <span className={styles.tabIndicator} aria-hidden="true" />
            {(['signup', 'login'] as const).map((tab) => (
              <button
                key={tab}
                className={tab === mode ? styles.tabActive : styles.tab}
                type="button"
                role="tab"
                aria-selected={tab === mode}
                onClick={() => {
                  setError(null)
                  setFieldErrors({})
                  navigate(tab === 'signup' ? '/vendor/signup' : '/vendor/login', { replace: true, state: { from } })
                }}
              >
                {tab === 'signup' ? 'Sign up' : 'Log in'}
              </button>
            ))}
          </div>

          {isSignup && (
            <div className={styles.names}>
              <TextField label="First name" placeholder="Ama" autoComplete="given-name" value={values.firstName} error={fieldErrors.firstName} onChange={set('firstName')} />
              <TextField label="Last name" placeholder="Mensah" autoComplete="family-name" value={values.lastName} error={fieldErrors.lastName} onChange={set('lastName')} />
            </div>
          )}
          <TextField label="Email" type="email" placeholder="ama@example.com" autoComplete="email" value={values.email} error={fieldErrors.email} onChange={set('email')} />
          <TextField
            label="Password"
            type="password"
            placeholder={isSignup ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
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
            {pending ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                {isSignup ? 'Creating your account…' : 'Logging in…'}
              </>
            ) : (
              <>
                {isSignup ? 'Create my account' : 'Log in'}
                <svg className={styles.arrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="M5 12h14m-5-5 5 5-5 5" />
                </svg>
              </>
            )}
          </button>

          <p className={styles.help}>Forgot your password? Call MarketiX on 020 000 0000.</p>
          <p className={styles.help}>
            MarketiX staff? <Link to="/login">Admin log in</Link>
          </p>
        </form>
      </section>
    </div>
  )
}

function BenefitIcon({ path }: { path: string }) {
  return (
    <span className={styles.benefitIcon} aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  )
}

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: 'text' | 'email' | 'password'
  placeholder?: string
  autoComplete?: string
}

function TextField({ label, value, onChange, error, type = 'text', placeholder, autoComplete }: TextFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        {label}
        <input
          className={error ? styles.inputInvalid : styles.input}
          type={isPassword && revealed ? 'text' : type}
          placeholder={placeholder}
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
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  )
}
