type Listener = () => void

const listeners = new Set<Listener>()

/** Signals that server data changed (after a create/update/delete), so views can refresh. */
export function notifyDataChanged(): void {
  listeners.forEach((listener) => listener())
}

/** Subscribe to data changes. Returns an unsubscribe function. */
export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
