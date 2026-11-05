import type { ReviewDecision } from './vendors'

/** Review-history labels; `dot` is the timeline dot class. */
export const REVIEW_DECISION: Record<ReviewDecision, { label: string; dot: 'dotSuccess' | 'dotDanger' | 'dotNeutral' }> = {
  APPROVED: { label: 'Approved', dot: 'dotSuccess' },
  MORE_INFO: { label: 'More info requested', dot: 'dotNeutral' },
  REJECTED: { label: 'Rejected', dot: 'dotDanger' },
  SUSPENDED: { label: 'Suspended', dot: 'dotDanger' },
  RELEASED: { label: 'Number released', dot: 'dotDanger' },
  REINSTATED: { label: 'Reinstated', dot: 'dotSuccess' },
}
