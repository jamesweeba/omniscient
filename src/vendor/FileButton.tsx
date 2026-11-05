import type { ReactNode } from 'react'
import styles from './vendor.module.css'
import local from './FileButton.module.css'

interface FileButtonProps {
  children: ReactNode
  /** Which files the picker offers, e.g. "image/*". */
  accept: string
  onPick: (file: File) => void
  primary?: boolean
  disabled?: boolean
  /** On phones, open the back camera instead of the gallery. */
  camera?: boolean
}

/** A small vendor button that opens the file picker and hands over the chosen file. */
export function FileButton({ children, accept, onPick, primary, disabled, camera }: FileButtonProps) {
  return (
    <label className={`${primary ? styles.primary : styles.secondary} ${styles.small} ${local.fileButton}`}>
      {children}
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        capture={camera ? 'environment' : undefined}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // so choosing the same file again still counts
          if (file) onPick(file)
        }}
      />
    </label>
  )
}
