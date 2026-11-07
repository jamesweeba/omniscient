import { useCallback, useEffect, useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { fetchProductVideos, type ProductVideo, type ProductVideos } from '@/lib/productVideos'

/** How often to check on a video being converted. */
const POLL_MS = 3000
/** What the product editor knows about a saved product's videos, and how to update one. */
export interface VideosState {
  videos: ProductVideos | null
  error: string | null
  /** A measure's video ('' = the whole product's), once loaded. */
  videoFor: (measure: string) => ProductVideo | null
  update: (measure: string, video: ProductVideo) => void
}

/**
 * Loads every video of a saved product (null id: nothing to load) and keeps checking back
 * while any is being converted.
 */
export function useProductVideos(productId: string | null): VideosState {
  const load = useCallback(() => (productId ? fetchProductVideos(productId) : Promise.resolve(null)), [productId])
  const result = useAsync(load, { live: true })
  const [videos, setVideos] = useState<ProductVideos | null>(null)
  const [seen, setSeen] = useState<ProductVideos | null>(null)
  const fresh = result.status === 'success' ? result.data : null
  if (fresh && fresh !== seen) {
    setSeen(fresh)
    setVideos(fresh)
  }
  const { reload } = result

  const processing = videos ? [videos.product, ...videos.measures.map((m) => m.video)].some((v) => v.status === 'PROCESSING') : false
  useEffect(() => {
    if (!processing) return
    const timer = setInterval(reload, POLL_MS)
    return () => clearInterval(timer)
  }, [processing, reload])

  return {
    videos,
    error: result.status === 'error' ? result.error : null,
    videoFor: (measure) => (videos ? (measure ? (videos.measures.find((m) => m.code === measure)?.video ?? null) : videos.product) : null),
    update: (measure, video) =>
      setVideos((v) => v && (measure ? { ...v, measures: v.measures.map((m) => (m.code === measure ? { ...m, video } : m)) } : { ...v, product: video })),
  }
}
