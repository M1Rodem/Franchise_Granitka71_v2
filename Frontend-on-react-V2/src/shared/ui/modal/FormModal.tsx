import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className={`${styles.modal} ${sizeClass}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
