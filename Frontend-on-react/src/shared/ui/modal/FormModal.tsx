import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './FormModal.module.css'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface FormModalProps {
  isOpen: boolean
  title: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
  size?: ModalSize
}

export function FormModal({
  isOpen,
  title,
  onClose,
  footer,
  children,
  size = 'md',
}: FormModalProps) {

  useEffect(() => {
    if (!isOpen) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    window.addEventListener('keydown', handleEsc)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleEsc)
    }

  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClass =
    size === 'sm'
      ? styles.modalSm
      : size === 'lg'
      ? styles.modalLg
      : size === 'xl'
      ? styles.modalXl
      : size === 'full'
      ? styles.modalFull
      : styles.modalMd

  return createPortal(
    <div
      className={styles.overlay}
      onClick={onClose}
    >
      <div
        className={`${styles.modal} ${sizeClass}`}
        onClick={(e) => e.stopPropagation()}
      >

        <h3 className={styles.title}>
          {title}
        </h3>

        <div className={styles.body}>
          {children}
        </div>

        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}

      </div>
    </div>,
    document.body
  )
}