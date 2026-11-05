import { useEffect, useState } from 'react'

/**
 * Fetches a protected image (it needs the token, so a plain <img src> won't do) and returns
 * an object URL for it, revoked when `key` changes or the component unmounts. Pass a null
 * key to load nothing. `load` is read when `key` changes, so it needn't be memoised.
 */
export function useBlobUrl(key: string | null, load: () => Promise<Blob>): string | null {
  const [state, setState] = useState<{ key: string; url: string } | null>(null)

  useEffect(() => {
    if (!key) return
    let objectUrl: string | null = null
    let cancelled = false
    load().then(
      (blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setState({ key, url: objectUrl })
      },
      () => {
        // No preview; the rest of the card still works.
      },
    )
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the key changes
  }, [key])

  return state && state.key === key ? state.url : null
}
