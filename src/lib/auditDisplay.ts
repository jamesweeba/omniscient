import type { BadgeTone } from '@/components/Badge/Badge'
import type { AuditAction } from './audit'

interface ActionDisplay {
  label: string
  tone: BadgeTone
  group: 'Shops' | 'Due diligence' | 'Notes' | 'Payouts' | 'WhatsApp numbers' | 'Promoters'
}

export const AUDIT_ACTION: Record<AuditAction, ActionDisplay> = {
  REVIEW_STARTED: { label: 'Review started', tone: 'neutral', group: 'Due diligence' },
  CHECKLIST_UPDATED: { label: 'Checklist updated', tone: 'neutral', group: 'Due diligence' },
  DOCUMENT_VIEWED: { label: 'Document viewed', tone: 'neutral', group: 'Due diligence' },
  NOTE_ADDED: { label: 'Note added', tone: 'neutral', group: 'Notes' },
  NOTE_EDITED: { label: 'Note edited', tone: 'neutral', group: 'Notes' },
  NOTE_DELETED: { label: 'Note deleted', tone: 'neutral', group: 'Notes' },
  BANNER_APPROVED: { label: 'Banner approved', tone: 'success', group: 'Shops' },
  BANNER_REJECTED: { label: 'Banner rejected', tone: 'danger', group: 'Shops' },
  BANNER_REMOVED: { label: 'Banner removed', tone: 'danger', group: 'Shops' },
  PAYOUT_SENT: { label: 'Payout sent', tone: 'success', group: 'Payouts' },
  PAYOUT_RETRIED: { label: 'Payout retried', tone: 'info', group: 'Payouts' },
  PAYOUTS_PAUSED: { label: 'Payouts paused', tone: 'danger', group: 'Payouts' },
  PAYOUTS_RESUMED: { label: 'Payouts resumed', tone: 'neutral', group: 'Payouts' },
  ORDER_RELEASED: { label: 'Order released for payout', tone: 'warning', group: 'Payouts' },
  APPROVED: { label: 'Approved', tone: 'success', group: 'Shops' },
  MORE_INFO_REQUESTED: { label: 'More info requested', tone: 'neutral', group: 'Shops' },
  REJECTED: { label: 'Rejected', tone: 'danger', group: 'Shops' },
  SUSPENDED: { label: 'Suspended', tone: 'danger', group: 'Shops' },
  REINSTATED: { label: 'Reinstated', tone: 'neutral', group: 'Shops' },
  NUMBER_ADDED: { label: 'Number added', tone: 'info', group: 'WhatsApp numbers' },
  NUMBER_RELEASED: { label: 'Number released', tone: 'danger', group: 'WhatsApp numbers' },
  NUMBER_FREED: { label: 'Number freed early', tone: 'info', group: 'WhatsApp numbers' },
  NUMBER_REFRESHED: { label: 'Number refreshed', tone: 'info', group: 'WhatsApp numbers' },
  PROMOTER_SUSPENDED: { label: 'Promoter suspended', tone: 'danger', group: 'Promoters' },
  PROMOTER_REINSTATED: { label: 'Promoter reinstated', tone: 'neutral', group: 'Promoters' },
  PROMOTER_PAYOUT_RETRIED: { label: 'Promoter payout retried', tone: 'info', group: 'Promoters' },
}

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION) as AuditAction[]

export const AUDIT_ACTION_GROUPS = [...new Set(AUDIT_ACTIONS.map((a) => AUDIT_ACTION[a].group))]
