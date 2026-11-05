import { useEffect, useState } from 'react'
import { errorMessage } from '@/lib/api'

export type BlobFile = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error'; error: string }

/**
 * Fetches a protected file (it needs the token, so a plain <img src> or link won't do) and
 * returns an object URL for it, revoked when `key` changes or the component unmounts. Pass a
 * null key to load nothing. `load` is read when `key` changes, so it needn't be memoised.
 */
export function useBlobFile(key: string | null, load: () => Promise<Blob>, failMessage = 'Couldn’t load the file.'): BlobFile {
  const [state, setState] = useState<{ key: string; file: BlobFile } | null>(null)

  useEffect(() => {
    if (!key) return
    let objectUrl: string | null = null
    let cancelled = false
    load().then(
      (blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setState({ key, file: { status: 'ready', url: objectUrl } })
      },
      (err: unknown) => {
        if (!cancelled) setState({ key, file: { status: 'error', error: errorMessage(err, failMessage) } })
      },
    )
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the key changes
  }, [key])

  return state && state.key === key ? state.file : { status: 'loading' }
}

/** Like useBlobFile, for a preview that's simply left out while loading or if it fails. */
export function useBlobUrl(key: string | null, load: () => Promise<Blob>): string | null {
  const file = useBlobFile(key, load)
  return file.status === 'ready' ? file.url : null
}
