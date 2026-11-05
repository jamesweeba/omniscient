import type { ReactNode } from 'react'

/** One "label: value" row of a <dl>. The list's own stylesheet lays the rows out. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
