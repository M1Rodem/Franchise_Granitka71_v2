import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from '@/shared/lib/media/components/media-preview-modal.module.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function MapPreviewModal({
  isOpen,
  onClose,
  children,
}: Props) {

  useEffect(() => {

    if (!isOpen) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
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

  return createPortal(

    <div className={styles.overlay}>

      <div
        className={styles.viewer}
        onClick={(e) => {

          const target = e.target as HTMLElement

          if (!target.closest('[data-map-container]')) {
            onClose()
          }

        }}
      >

        {children}

      </div>

    </div>,

    document.body
  )
}