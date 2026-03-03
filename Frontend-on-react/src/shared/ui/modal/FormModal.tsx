import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './confirm-modal.module.css'

interface FormModalProps {
  isOpen: boolean
  title: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}

export function FormModal({
  isOpen,
  title,
  onClose,
  footer,
  children,
}: FormModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEsc)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className={styles.overlay}
      onClick={onClose}
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.title}>{title}</h3>

        <div className={styles.message}>
          {children}
        </div>

        {footer && (
          <div className={styles.actions}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}