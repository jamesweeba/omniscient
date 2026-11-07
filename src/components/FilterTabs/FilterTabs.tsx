import type { ReactNode } from 'react'
import page from '@/styles/page.module.css'

interface FilterTabsProps<T extends { key: string; label: string }> {
  /** Names the group for screen readers, e.g. "Filter by status". */
  label: string
  tabs: readonly T[]
  active: T['key']
  onSelect: (key: T['key'], index: number) => void
  /** The badge after a tab's label; nothing (null, undefined or false) shows no badge. */
  count?: (tab: T) => ReactNode
}

/** The row of filter tabs above a list. */
export function FilterTabs<T extends { key: string; label: string }>({ label, tabs, active, onSelect, count }: FilterTabsProps<T>) {
  return (
    <div className={page.tabs} role="group" aria-label={label}>
      {tabs.map((tab, index) => {
        const badge = count?.(tab)
        return (
          <button
            key={tab.key}
            className={tab.key === active ? page.tabActive : page.tab}
            type="button"
            aria-pressed={tab.key === active}
            onClick={() => onSelect(tab.key, index)}
          >
            {tab.label}
            {badge !== undefined && badge !== null && badge !== false && <span className={page.tabCount}>{badge}</span>}
          </button>
        )
      })}
    </div>
  )
}
