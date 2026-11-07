export type UserRole = 'SUPER_ADMIN' | 'VENDOR' | (string & {})

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  createdAt: string
}

export interface Session {
  user: User
  accessToken: string
}

const STORAGE_KEY = 'marketix.session'

type Listener = () => void
const clearListeners = new Set<Listener>()

/** Returns the stored session, or null if missing or the token has expired. */
export function getStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const session = JSON.parse(raw) as Session
    if (isTokenExpired(session.accessToken)) {
      clearSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function getAccessToken(): string | null {
  return getStoredSession()?.accessToken ?? null
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable; the session lasts until the page reloads.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable; nothing to clear.
  }
  clearListeners.forEach((listener) => listener())
}

/** Subscribe to session being cleared (logout or rejected token). Returns an unsubscribe function. */
export function onSessionCleared(listener: Listener): () => void {
  clearListeners.add(listener)
  return () => clearListeners.delete(listener)
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload)) as { exp?: number }
    return typeof exp === 'number' && exp * 1000 <= Date.now()
  } catch {
    return true
  }
}
