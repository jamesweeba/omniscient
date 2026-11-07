import { api, apiRequest } from './api'
import { clearSession, saveSession, type Session, type User, type UserRole } from './session'

export type { Session, User, UserRole } from './session'
export { getStoredSession, onSessionCleared } from './session'

export interface Credentials {
  email: string
  password: string
}

export interface SignupInput extends Credentials {
  firstName: string
  lastName: string
}

/** The two sides of the app and who may use each. */
export type AppArea = 'admin' | 'vendor'

/** Roles allowed in each area. */
const AREA_ROLES: Record<AppArea, readonly UserRole[]> = {
  admin: ['SUPER_ADMIN'],
  vendor: ['VENDOR'],
}

const WRONG_AREA: Record<AppArea, string> = {
  admin: 'This is a vendor account. Vendors log in at the vendor app.',
  vendor: 'This is a MarketiX staff account. Use the admin login instead.',
}

/** Where a logged-in user belongs. */
export function homePathFor(role: UserRole): string {
  return canUseArea(role, 'vendor') ? '/vendor' : '/review-queue'
}

export function canUseArea(role: UserRole, area: AppArea): boolean {
  return AREA_ROLES[area].includes(role)
}

/** Logs in for one area; accounts with another role are refused and not stored. */
export async function login(credentials: Credentials, area: AppArea): Promise<Session> {
  const session = await apiRequest<Session>('/auth/login', {
    method: 'POST',
    body: credentials,
    auth: false,
  })
  if (!canUseArea(session.user.role, area)) throw new Error(WRONG_AREA[area])

  saveSession(session)
  return session
}

/**
 * Creates a vendor account. The backend always assigns the vendor role (it rejects a
 * `role` field), so the browser never chooses one.
 */
export async function signup(input: SignupInput): Promise<Session> {
  const session = await apiRequest<Session>('/auth/signup', {
    method: 'POST',
    body: input,
    auth: false,
  })
  if (!canUseArea(session.user.role, 'vendor')) {
    throw new Error('Sign-up returned an unexpected account type. Please contact MarketiX.')
  }

  saveSession(session)
  return session
}

/** Fetches the signed-in user. Sends the stored token; a 401 clears the session. */
export async function fetchCurrentUser(): Promise<User> {
  const { user } = await api.get<{ user: User }>('/auth/me')
  return user
}

export function logout(): void {
  clearSession()
}
