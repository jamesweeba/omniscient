export interface GhanaPhone {
  /** "233244127781" — for wa.me links and APIs. */
  digits: string
  /** "+233 24 412 7781" */
  international: string
  /** "024 412 7781" — how Ghanaians write it. */
  local: string
  /** "0244127781" — what the API takes. */
  compact: string
}

/** Parses "024 412 7781", "+233 24 412 7781" or "233244127781"; null if not a Ghana number. */
export function parseGhanaPhone(input: string): GhanaPhone | null {
  let digits = input.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `233${digits.slice(1)}`
  if (!/^233\d{9}$/.test(digits)) return null

  const national = digits.slice(3)
  return {
    digits,
    international: `+233 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`,
    local: `0${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`,
    compact: `0${national}`,
  }
}

/** "0244111222" → "+233 24 411 1222" (or "024 411 1222" with `local`); other values as they are. */
export function formatPhone(value: string, style: 'international' | 'local' = 'international'): string {
  return parseGhanaPhone(value)?.[style] ?? value
}
