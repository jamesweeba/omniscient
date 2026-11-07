import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  fetchCurrentUser,
  getStoredSession,
  login as loginRequest,
  logout as clearStoredSession,
  onSessionCleared,
  signup as signupRequest,
  type AppArea,
  type Credentials,
  type Session,
  type SignupInput,
} from '@/lib/auth'
import { SESSION_STORAGE_KEY } from '@/lib/session'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(getStoredSession)

  // Drop back to logged-out whenever the session is cleared (logout or rejected token).
  useEffect(() => onSessionCleared(() => setSession(null)), [])

  // Logging out (or in as someone else) in another tab applies here too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === SESSION_STORAGE_KEY) setSession(getStoredSession())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Check a stored session against the API on load; a rejected token logs the user out.
  useEffect(() => {
    if (!getStoredSession()) return
    fetchCurrentUser()
      .then((user) => setSession((current) => (current ? { ...current, user } : current)))
      .catch(() => {
        // 401 is handled by the API client; other failures keep the stored session.
      })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      login: async (credentials: Credentials, area: AppArea) => setSession(await loginRequest(credentials, area)),
      signup: async (input: SignupInput) => setSession(await signupRequest(input)),
      logout: clearStoredSession,
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
