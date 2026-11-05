import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, type NavigateOptions } from 'react-router'
import { useDebouncedValue } from './useDebouncedValue'

export type ParamChanges = Record<string, string | null | undefined>
export type UpdateParams = (changes: ParamChanges, options?: NavigateOptions) => void

/** URL search params plus an updater that sets or (for empty values) removes keys. */
export function useUrlParams(): [URLSearchParams, UpdateParams] {
  const [params, setParams] = useSearchParams()

  const update = useCallback<UpdateParams>(
    (changes, options) =>
      setParams((current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      }, options),
    [setParams],
  )

  return [params, update]
}

/**
 * A search box bound to a URL param. The URL updates once typing pauses (and resets
 * `page`), so each keystroke doesn't trigger a request.
 * Returns [inputValue, setInputValue, committedValueFromUrl].
 */
export function useSearchParamInput(params: URLSearchParams, update: UpdateParams, key = 'q') {
  const committed = params.get(key) ?? ''
  const [input, setInput] = useState(committed)
  const debounced = useDebouncedValue(input.trim())
  const lastWritten = useRef(debounced)

  useEffect(() => {
    // Only write when the typed value changes, so back/forward navigation isn't overwritten.
    if (debounced === lastWritten.current) return
    lastWritten.current = debounced
    update({ [key]: debounced, page: null }, { replace: true })
  }, [debounced, key, update])

  return [input, setInput, committed] as const
}

/** Reads a 1-based page number from the URL. */
export const pageParam = (params: URLSearchParams) => Math.max(1, Number(params.get('page')) || 1)
