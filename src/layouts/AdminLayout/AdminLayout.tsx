import { Suspense, useEffect, useRef, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary'
import { LogoMark } from '@/components/LogoMark/LogoMark'
import { PageLoading } from '@/components/PageLoading/PageLoading'
import { useAuth } from '@/context/auth-context'
import { useAsync } from '@/hooks/useAsync'
import { shortName } from '@/lib/format'
import { fetchPayoutsOverview } from '@/lib/payouts'
import { fetchAdminSummary } from '@/lib/vendors'
import styles from './AdminLayout.module.css'

export function AdminLayout() {
  const { session, logout } = useAuth()
  // Keep the sidebar counts current after approvals, releases, payouts, etc.
  const summary = useAsync(fetchAdminSummary, { live: true })
  const payouts = useAsync(fetchPayoutsOverview, { live: true })
  const counts = summary.status === 'success' ? summary.data : null
  const failedPayouts = payouts.status === 'success' ? payouts.data.failedPayouts : 0

  // Only the content area scrolls, so start each new page at its top (the browser only
  // does this for the window).
  const { pathname } = useLocation()
  const contentRef = useRef<HTMLElement>(null)
  useEffect(() => contentRef.current?.scrollTo(0, 0), [pathname])

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar} aria-label="Admin">
        <div className={styles.brand}>
          <LogoMark />
          <div className={styles.brandText}>
            <span className={styles.brandName}>MarketiX</span>
            <span className={styles.brandRole}>Super admin</span>
          </div>
        </div>

        <div className={styles.links}>
          <SidebarLink to="/review-queue" label="Review queue" icon={<QueueIcon />}>
            {counts && <span className={styles.badgeHighlight}>{counts.waitingForReview}</span>}
          </SidebarLink>
          <SidebarLink to={counts?.bannersToApprove ? '/vendors?banner=pending' : '/vendors'} label="Vendors" icon={<StoreIcon />}>
            {counts && counts.bannersToApprove > 0 && (
              <span className={styles.badgeWarning}>
                {counts.bannersToApprove} {counts.bannersToApprove === 1 ? 'banner' : 'banners'}
              </span>
            )}
          </SidebarLink>
          <SidebarLink to="/whatsapp-numbers" label="WhatsApp numbers" icon={<PhoneIcon />}>
            {counts && (
              <span className={styles.badgeWarning}>{counts.freeWhatsAppNumbers} free</span>
            )}
          </SidebarLink>
          <SidebarLink to="/orders" label="Orders" icon={<BagIcon />} />
          <SidebarLink to={failedPayouts ? '/payouts?view=payouts&status=failed' : '/payouts'} label="Payouts" icon={<WalletIcon />}>
            {failedPayouts > 0 && <span className={styles.badgeWarning}>{failedPayouts} failed</span>}
          </SidebarLink>
          <SidebarLink to="/audit-log" label="Audit log" icon={<LogIcon />} />
        </div>

      </nav>

      <div className={styles.main}>
        <header className={styles.header}>
          <span className={styles.section}>{sectionTitle(pathname)}</span>
          {session && (
            <div className={styles.account}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(session.user)}
              </span>
              <span className={styles.accountText}>
                <span className={styles.accountName}>{shortName(session.user)}</span>
                <span className={styles.accountRole}>{roleLabel(session.user.role)}</span>
              </span>
              <button className={styles.logout} type="button" onClick={logout}>
                Log out
              </button>
            </div>
          )}
        </header>

        <main ref={contentRef} className={styles.content}>
          {/* A crashed page keeps the sidebar; moving to another page tries again. */}
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

interface SidebarLinkProps {
  to: string
  label: string
  icon: ReactNode
  /** A count badge, shown on the right. */
  children?: ReactNode
}

function SidebarLink({ to, label, icon, children }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => (isActive ? `${styles.link} ${styles.linkActive}` : styles.link)}
    >
      <span className={styles.linkLabel}>
        {icon}
        <span>{label}</span>
      </span>
      {children}
    </NavLink>
  )
}

function roleLabel(role: string): string {
  const words = role.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The header's section name, from the first part of the path. */
const SECTIONS: Record<string, string> = {
  'review-queue': 'Review queue',
  vendors: 'Vendors',
  'whatsapp-numbers': 'WhatsApp numbers',
  orders: 'Orders',
  payouts: 'Payouts',
  'audit-log': 'Audit log',
}

function sectionTitle(pathname: string): string {
  return SECTIONS[pathname.split('/')[1] ?? ''] ?? 'Admin'
}

function initials({ firstName, lastName }: { firstName: string; lastName: string }): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?'
}

// Sidebar icons: 18px, drawn with the text colour so they follow hover and active states.

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.linkIcon}
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

/** A clipboard with a tick: shops waiting to be checked. */
function QueueIcon() {
  return (
    <NavIcon>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="m9 13 2 2 4-4" />
    </NavIcon>
  )
}

/** A shop front with an awning. */
function StoreIcon() {
  return (
    <NavIcon>
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <path d="M5.5 12v8h13v-8" />
      <path d="M10 20v-4.5h4V20" />
    </NavIcon>
  )
}

/** A phone handset in a chat bubble. */
function PhoneIcon() {
  return (
    <NavIcon>
      <path d="M4.5 20 6 15.6A8 8 0 1 1 8.4 18z" />
      <path d="M9.6 9.2c.3 1.9 1.6 3.6 3.6 4.6l1-1 1.6.8-.4 1.4c-2.8.3-6.3-2.7-6.6-5.6l1.3-.6.9 1.5z" />
    </NavIcon>
  )
}

/** A shopping bag. */
function BagIcon() {
  return (
    <NavIcon>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </NavIcon>
  )
}

/** A clock with a back arrow: the history of admin actions. */
function LogIcon() {
  return (
    <NavIcon>
      <path d="M12 3a9 9 0 1 1-8.5 6" />
      <path d="M3 4v5h5" />
      <path d="M12 8v4l3 2" />
    </NavIcon>
  )
}

/** A wallet: money owed to and sent to vendors. */
function WalletIcon() {
  return (
    <NavIcon>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <path d="M4 7.5V17a2 2 0 0 0 2 2h14V8H6.5A2.5 2.5 0 0 1 4 7.5" />
      <path d="M16 13.5h.01" />
    </NavIcon>
  )
}
