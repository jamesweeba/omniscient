import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary'
import { LogoMark } from '@/components/LogoMark/LogoMark'
import { PageLoading } from '@/components/PageLoading/PageLoading'
import { useAuth } from '@/context/auth-context'
import { useAsync } from '@/hooks/useAsync'
import { shortName } from '@/lib/format'
import { fetchShopStatus, type ShopStatus, type TenantStatus } from '@/lib/vendorPortal'
import type { VendorContext } from './useVendorPortal'
import styles from './vendor.module.css'

/** How often to check for a review decision while the shop waits in the queue. */
const POLL_MS = 45_000

const NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/vendor', label: 'Home', icon: <HomeIcon /> },
  { to: '/vendor/orders', label: 'Orders', icon: <BagIcon /> },
  { to: '/vendor/products', label: 'Products', icon: <BoxIcon /> },
  { to: '/vendor/money', label: 'Money', icon: <WalletIcon /> },
  { to: '/vendor/promoters', label: 'Promoters', icon: <MegaphoneIcon /> },
  { to: '/vendor/shop', label: 'Shop settings', icon: <StoreIcon /> },
]

const STATUS: Record<TenantStatus, { label: string; tone: 'live' | 'wait' | 'bad' }> = {
  PENDING: { label: 'Setting up', tone: 'wait' },
  STOCKED: { label: 'Waiting for review', tone: 'wait' },
  UNDER_REVIEW: { label: 'In review', tone: 'wait' },
  MORE_INFO: { label: 'Needs changes', tone: 'bad' },
  REJECTED: { label: 'Not approved', tone: 'bad' },
  ACTIVE: { label: 'Live on WhatsApp', tone: 'live' },
  SUSPENDED: { label: 'Suspended', tone: 'bad' },
}

/** Frame for logged-in vendor pages; loads the shop's status once for all of them. */
export function VendorLayout() {
  const { session, logout } = useAuth()
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

  // Phones: the menu is a drawer. Close it when the page changes.
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(pathname)
  if (menuPath !== pathname) {
    setMenuPath(pathname)
    setMenuOpen(false)
  }

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // The browser keeps the scroll position between pages of a single-page app; start each at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(reload, POLL_MS)
    return () => clearInterval(timer)
  }, [waiting, reload])

  // Without a shop, the only page that makes sense is the create-shop form.
  if (shop === null && pathname !== '/vendor/shop') return <Navigate to="/vendor/shop" replace />

  const status = shop ? STATUS[shop.status] : null
  const user = session?.user

  return (
    <div className={styles.shell}>
      <header className={styles.mobileBar}>
        <Link className={styles.brand} to="/vendor">
          <LogoMark />
          MarketiX
        </Link>
        {shop && (
          <button
            className={styles.menuButton}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="vendor-sidebar"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
            <span className={styles.visuallyHiddenInline}>Menu</span>
          </button>
        )}
      </header>

      {menuOpen && <div className={styles.backdrop} onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <aside id="vendor-sidebar" className={menuOpen ? `${styles.sidebar} ${styles.sidebarOpen}` : styles.sidebar}>
        <Link className={styles.sidebarBrand} to="/vendor">
          <LogoMark />
          <span className={styles.brandText}>
            <span className={styles.brandName}>MarketiX</span>
            <span className={styles.brandRole}>Seller centre</span>
          </span>
        </Link>

        {shop && (
          <nav className={styles.nav} aria-label="Vendor">
            {NAV.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/vendor'}
                className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink)}
              >
                {icon}
                {label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className={styles.sidebarFoot}>
          {status && (
            <span className={styles.statusChip} data-tone={status.tone}>
              <span className={styles.statusDot} aria-hidden="true" />
              {status.label}
            </span>
          )}
          {user && (
            <div className={styles.account}>
              <span className={styles.avatar} aria-hidden="true">
                {`${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()}
              </span>
              <span className={styles.accountText}>
                <span className={styles.accountName}>{shortName(user)}</span>
                <span className={styles.accountEmail}>{user.email}</span>
              </span>
            </div>
          )}
          <button className={styles.logout} type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

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
          // A crashed page keeps the sidebar; moving to another page tries again.
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

// Sidebar icons: 18px, drawn with the text colour so they follow hover and active states.

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.navIcon}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function HomeIcon() {
  return (
    <NavIcon>
      <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" />
    </NavIcon>
  )
}

function BagIcon() {
  return (
    <NavIcon>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </NavIcon>
  )
}

function BoxIcon() {
  return (
    <NavIcon>
      <path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z" />
      <path d="M4 7.5 12 11l8-3.5M12 11v9" />
    </NavIcon>
  )
}

function WalletIcon() {
  return (
    <NavIcon>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <path d="M4 7.5V17a2 2 0 0 0 2 2h14V8H6.5A2.5 2.5 0 0 1 4 7.5" />
      <path d="M16 13.5h.01" />
    </NavIcon>
  )
}

function MegaphoneIcon() {
  return (
    <NavIcon>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </NavIcon>
  )
}

function StoreIcon() {
  return (
    <NavIcon>
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <path d="M5.5 12v8h13v-8" />
    </NavIcon>
  )
}
