import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './Dialog.module.css'

interface DialogProps {
  title: string
  description?: ReactNode
  /** Called on Escape, backdrop click or the close button. */
  onClose: () => void
  /** 'wide' for content such as document previews. */
  size?: 'default' | 'wide'
  children: ReactNode
}

/** Modal dialog built on <dialog>. Mount it to open it; unmount to close. */
export function Dialog({ title, description, onClose, size = 'default', children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className={size === 'wide' ? `${styles.dialog} ${styles.wide}` : styles.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className={styles.body}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button className={styles.close} type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {description && <div className={styles.description}>{description}</div>}
        {children}
      </div>
    </dialog>
  )
}
