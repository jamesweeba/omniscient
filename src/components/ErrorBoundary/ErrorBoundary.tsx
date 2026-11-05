import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
  /** When this changes (e.g. the page address), a crashed page gets another try. */
  resetKey?: string
  /** Fill the whole screen: for the outermost boundary, where no layout is drawn. */
  fullPage?: boolean
}

/**
 * A file the app tried to load isn't there, which usually means MarketiX was updated while
 * the page was open. Reloading fetches the new version.
 */
function isUpdateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|module script failed|Failed to fetch dynamically|Unable to preload CSS/i.test(message)
}

/**
 * Catches a page that crashes while drawing and shows a way out, instead of a blank screen.
 * Inside a layout, the navigation stays usable.
 */
export class ErrorBoundary extends Component<Props, { error: unknown; resetKey?: string }> {
  state: { error: unknown; resetKey?: string } = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  // A new page address clears the error, so the next page gets a fresh try.
  static getDerivedStateFromProps(props: Props, state: { resetKey?: string }) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('A page crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const updated = isUpdateError(this.state.error)

    return (
      <div className={this.props.fullPage ? styles.fullPage : styles.inline} role="alert">
        <div className={styles.card}>
          <h1 className={styles.title}>{updated ? 'MarketiX has been updated' : 'Something went wrong'}</h1>
          <p className={styles.text}>
            {updated
              ? 'Reload the page to get the latest version.'
              : 'This page ran into a problem. Your shop and your money are safe. Reload to try again, and if it keeps happening, contact MarketiX support.'}
          </p>
          <div className={styles.actions}>
            <button className={styles.primary} type="button" onClick={() => window.location.reload()}>
              Reload page
            </button>
            {!updated && (
              <a className={styles.secondary} href="/">
                Go to home
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }
}
