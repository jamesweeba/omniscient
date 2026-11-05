import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }

interface Settled<T> {
  state: AsyncState<T>
  load: () => Promise<T>
  attempt: number
}

/**
 * Runs `load` on mount and whenever it changes (pass a stable function: module-level or
 * memoised with useCallback). Previous data stays visible while a reload is in flight;
 * `isFetching` tells you one is. Call `reload` to fetch again.
 */
export function useAsync<T>(
  load: () => Promise<T>,
): AsyncState<T> & { isFetching: boolean; reload: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)

  useEffect(() => {
    let cancelled = false
    const settle = (state: AsyncState<T>) => !cancelled && setSettled({ state, load, attempt })

    load().then(
      (data) => settle({ status: 'success', data }),
      (err: unknown) =>
        settle({ status: 'error', error: err instanceof Error ? err.message : 'Something went wrong.' }),
    )

    return () => {
      cancelled = true
    }
  }, [load, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  return {
    ...(settled?.state ?? { status: 'loading' }),
    isFetching: settled?.load !== load || settled.attempt !== attempt,
    reload,
  }
}
