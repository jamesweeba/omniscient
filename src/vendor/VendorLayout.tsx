import { Suspense, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary'
import { LogoMark } from '@/components/LogoMark/LogoMark'
import { PageLoading } from '@/components/PageLoading/PageLoading'
import { useAuth } from '@/context/auth-context'
import { useAsync } from '@/hooks/useAsync'
import { fetchShopStatus, type ShopStatus } from '@/lib/vendorPortal'
import type { VendorContext } from './useVendorPortal'
import styles from './vendor.module.css'

/** How often to check for a review decision while the shop waits in the queue. */
const POLL_MS = 45_000

const NAV = [
  { to: '/vendor', label: 'Home' },
  { to: '/vendor/products', label: 'Products' },
  { to: '/vendor/orders', label: 'Orders' },
  { to: '/vendor/money', label: 'Money' },
  { to: '/vendor/shop', label: 'Shop' },
]

/** Frame for logged-in vendor pages; loads the shop's status once for all of them. */
export function VendorLayout() {
  const { logout } = useAuth()
  const { pathname } = useLocation()
  // Any change the vendor makes (shop, documents, products) can change the checklist or status.
  const result = useAsync(fetchShopStatus, { live: true })
  const { reload } = result
  // Keep showing the last status if a later refresh fails (e.g. a dropped connection while polling).
  const [lastShop, setLastShop] = useState<ShopStatus | null | undefined>(undefined)
  const fresh = result.status === 'success' ? result.data : undefined
  if (fresh !== undefined && fresh !== lastShop) setLastShop(fresh)
  const shop = fresh ?? lastShop
  const waiting = shop?.status === 'STOCKED' || shop?.status === 'UNDER_REVIEW'


  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(reload, POLL_MS)
    return () => clearInterval(timer)
  }, [waiting, reload])

  // Without a shop, the only page that makes sense is the create-shop form.
  if (shop === null && pathname !== '/vendor/shop') return <Navigate to="/vendor/shop" replace />

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <Link className={styles.brand} to="/vendor">
          <LogoMark />
          MarketiX
        </Link>
        <button className={styles.logout} type="button" onClick={logout}>
          Log out
        </button>
      </header>
      {shop && (
        <nav className={styles.nav} aria-label="Vendor">
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/vendor'} className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}>
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      <main className={styles.main}>
        {result.status === 'error' && (
          <div className={styles.alertError} role="alert">
            {result.error}{' '}
            <button className={styles.textButton} type="button" onClick={reload}>
              Try again
            </button>
          </div>
        )}
        {shop === undefined && result.status === 'loading' && <p className={styles.centered}>Loading your shop…</p>}
        {shop !== undefined && (
          // A crashed page keeps the top bar and menu; moving to another page tries again.
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageLoading />}>
              <Outlet context={{ shop, refresh: reload } satisfies VendorContext} />
            </Suspense>
          </ErrorBoundary>
        )}
      </main>
    </div>
  )
}
