import type { ChecklistKey } from './vendors'

/** The due-diligence checks; all four must be ticked before approval. */
export const CHECKLIST: { key: ChecklistKey; title: string; hint: string }[] = [
  {
    key: 'ghanaCardMatches',
    title: 'Ghana Card matches the owner',
    hint: 'Name and photo on the card match the owner details.',
  },
  {
    key: 'momoNameMatches',
    title: 'MoMo name matches',
    hint: 'The payout number is registered to the owner, not someone else.',
  },
  {
    key: 'calledOwner',
    title: 'Called the owner',
    hint: 'Confirmed the stall location and that they expect WhatsApp orders.',
  },
  {
    key: 'productsLookGenuine',
    title: 'Products look genuine',
    hint: 'Real groceries, sensible prices, nothing prohibited.',
  },
]
