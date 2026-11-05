import { BackLink } from '@/components/BackLink/BackLink'
import { isKycLocked, isReadOnly, type TenantStatus } from '@/lib/vendorPortal'
import styles from '../vendor.module.css'

interface VendorPageHeaderProps {
  title: string
  lead: string
  /** Hide the back link (e.g. on the create-shop form, before there is a dashboard). */
  noBack?: boolean
}

/** Back link and heading for a vendor sub-page. */
export function VendorPageHeader({ title, lead, noBack }: VendorPageHeaderProps) {
  return (
    <>
      {!noBack && (
        <BackLink to="/vendor">My shop</BackLink>
      )}
      <div className={styles.heading}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
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
    return <p className={styles.alertInfo}>While {why}, {what} can’t be changed. Contact MarketiX support if something is wrong.</p>
  }
  return null
}
