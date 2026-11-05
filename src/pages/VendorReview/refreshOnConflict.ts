import { isConflict } from '@/lib/api'

export type FlashTone = 'success' | 'warning'

/** Reloads the shop and shows a message at the top of the review screen. */
export type OnChanged = (message: string, tone?: FlashTone) => void

/**
 * Runs an action. A 409 means the shop changed under us (someone else acted), so instead
 * of an error in place, show the server's message and reload the shop. Other errors throw.
 */
export async function refreshOnConflict(action: () => Promise<void>, onChanged: OnChanged): Promise<void> {
  try {
    await action()
  } catch (err) {
    if (!isConflict(err)) throw err
    onChanged(`${err.message} Showing the latest.`, 'warning')
  }
}
