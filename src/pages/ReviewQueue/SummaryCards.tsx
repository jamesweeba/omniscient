import { StatCard, StatGrid } from '@/components/StatCard/StatCard'
import { formatWaiting } from '@/lib/format'
import type { AdminSummary } from '@/lib/vendors'

/** At or below this many free numbers the tile turns amber: approval fails at 0. */
export const LOW_NUMBERS_THRESHOLD = 2

interface SummaryCardsProps {
  summary: AdminSummary
  /** When the longest-waiting shop was submitted, if any. */
  oldestWaiting: string | null
}

export function SummaryCards({ summary, oldestWaiting }: SummaryCardsProps) {
  const free = summary.freeWhatsAppNumbers
  const lowOnNumbers = free <= LOW_NUMBERS_THRESHOLD

  return (
    <StatGrid label="Summary">
      <StatCard
        label="Waiting for review"
        value={summary.waitingForReview}
        note={oldestWaiting ? `Oldest waiting ${formatWaiting(oldestWaiting)}` : 'Queue is empty'}
        noteTone={oldestWaiting ? 'warning' : 'muted'}
      />
      <StatCard label="More info requested" value={summary.moreInfoRequested} note="Waiting on vendor" />
      <StatCard
        label="Free WhatsApp numbers"
        value={free}
        valueTone={lowOnNumbers ? 'warning' : undefined}
        highlighted={free === 0}
        note={free === 0 ? 'Add a number before approving' : lowOnNumbers ? 'Running low: add more' : 'Ready to assign'}
        noteTone={lowOnNumbers ? 'warning' : 'muted'}
      />
      <StatCard label="Active shops" value={summary.activeShops} note="Live on WhatsApp" />
    </StatGrid>
  )
}
