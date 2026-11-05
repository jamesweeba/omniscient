import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/context/auth-context'
import { canUseArea, homePathFor, type AppArea } from '@/lib/auth'

const LOGIN_PATH: Record<AppArea, string> = { admin: '/login', vendor: '/vendor/login' }

/**
 * Renders child routes only for users allowed in `area`. Logged-out users go to that
 * area's login; users with another role go to their own home.
 */
export function RequireAuth({ area }: { area: AppArea }) {
  const { session } = useAuth()
  const location = useLocation()

  if (!session) {
    return <Navigate to={LOGIN_PATH[area]} replace state={{ from: location.pathname + location.search }} />
  }
  if (!canUseArea(session.user.role, area)) {
    return <Navigate to={homePathFor(session.user.role)} replace />
  }
  return <Outlet />
}
