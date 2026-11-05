import { useCallback, useState } from 'react'
import { errorMessage } from '@/lib/api'

interface RunOptions {
  /** Shown when the error has no message of its own. */
  fallback?: string
  /**
   * Keep `pending` after success, because the screen is about to change (navigating away,
   * a dialog closing, the parent swapping this part out). Stops a second click meanwhile.
   */
  keepPendingOnSuccess?: boolean
  /**
   * Handle an error yourself: return the message to show, or null to show none (e.g. a
   * 409 handled by reloading the page instead).
   */
  onError?: (err: unknown) => string | null
}

/**
 * The pending flag and error message for a button or form that calls the API.
 * `run(action)` clears the error, marks it pending, runs the action, and shows the error if
 * it fails. Resolves true when the action succeeded.
 */
export function useAction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (action: () => Promise<unknown>, options: RunOptions = {}): Promise<boolean> => {
    setPending(true)
    setError(null)
    try {
      await action()
      if (!options.keepPendingOnSuccess) setPending(false)
      return true
    } catch (err) {
      setError(options.onError ? options.onError(err) : errorMessage(err, options.fallback))
      setPending(false)
      return false
    }
  }, [])

  return { pending, error, setError, run }
}
