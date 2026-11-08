import type { ReactNode } from 'react'
import { BackLink } from '@/components/BackLink/BackLink'
import { isKycLocked, isReadOnly, type TenantStatus } from '@/lib/vendorPortal'
import styles from '../vendor.module.css'

interface VendorPageHeaderProps {
  title: ReactNode
  lead?: ReactNode
  /** A link to the page above, for pages the sidebar doesn't list (e.g. Documents, an order). */
  back?: { to: string; label: string }
  /** Buttons shown on the right of the title (stacked under it on phones). */
  actions?: ReactNode
}

/** Title, short explanation and page actions at the top of a vendor page. */
export function VendorPageHeader({ title, lead, back, actions }: VendorPageHeaderProps) {
  return (
    <>
      {back && <BackLink to={back.to}>{back.label}</BackLink>}
      <div className={styles.pageHeader}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{title}</h1>
          {lead && <p className={styles.lead}>{lead}</p>}
        </div>
        {actions && <div className={styles.pageActions}>{actions}</div>}
      </div>
    </>
  )
}

/** Explains why some or all of a page can't be changed right now. */
export function LockNotice({ status, what }: { status: TenantStatus; what: string }) {
  if (isReadOnly(status)) {
    return <p className={styles.alertError}>Your shop is suspended, so you can’t make changes. Contact MarketiX support.</p>
  }
  if (isKycLocked(status)) {
    const why = status === 'ACTIVE' ? 'your shop is live' : 'MarketiX is reviewing your shop'
    return (
      <p className={styles.alertInfo}>
        While {why}, {what} can’t be changed. Contact MarketiX support if something is wrong.
      </p>
    )
  }
  return null
}
