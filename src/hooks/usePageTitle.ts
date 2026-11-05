import { useEffect } from 'react'
import { useLocation } from 'react-router'

/**
 * Sets the browser tab title: "Money · MarketiX" for vendors, "Payouts · MarketiX Admin"
 * for admins. Pass null while the page is still loading its name.
 */
export function usePageTitle(title: string | null | undefined) {
  const { pathname } = useLocation()
  const vendorApp = pathname === '/vendor' || pathname.startsWith('/vendor/') // not /vendors (admin)
  const app = vendorApp ? 'MarketiX' : 'MarketiX Admin'
  useEffect(() => {
    document.title = title ? `${title} · ${app}` : app
  }, [title, app])
}
