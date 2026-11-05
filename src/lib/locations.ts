/** Kumasi markets vendors trade in. */
export const MARKETS = [
  'Kejetia, Kumasi',
  'Central, Kumasi',
  'Asafo, Kumasi',
  'Bantama, Kumasi',
  'Tafo, Kumasi',
  'Adum, Kumasi',
  'Suame, Kumasi',
  'Ayigya, Kumasi',
]

/** Areas a shop can offer delivery to (vendors' saved areas are shown too). */
export const DELIVERY_AREAS = [
  'Adum',
  'Ahodwo',
  'Asokwa',
  'Ayigya',
  'Bantama',
  'KNUST',
  'Kwadaso',
  'Nhyiaeso',
  'Santasi',
  'Suame',
  'Tafo',
]

/** Delivery windows a shop can offer. The API always adds "as soon as possible" itself. */
export const DELIVERY_SLOTS = ['Today, 8–10am', 'Today, 10am–12pm', 'Today, 12–2pm', 'Today, 2–4pm', 'Today, 4–6pm', 'Tomorrow morning']

/** The id the API expects for an area or slot: lowercase letters, digits and `_`. */
export function optionId(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'option'
  )
}
