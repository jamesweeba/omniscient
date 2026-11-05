import { createContext, useContext } from 'react'
import type { AppArea, Credentials, Session, SignupInput } from '@/lib/auth'

export interface AuthContextValue {
  session: Session | null
  login: (credentials: Credentials, area: AppArea) => Promise<void>
  signup: (input: SignupInput) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
