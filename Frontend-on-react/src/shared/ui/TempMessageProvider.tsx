import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { registerTempMessageHandler } from '@/shared/ui/temp-message.service'
import type { TempMessagePayload } from '@/shared/ui/temp-message.service'
import styles from './temp-message.module.css'
import { AppIcon } from '@/shared/ui/AppIcon'

export function TempMessageProvider() {

  const [current, setCurrent] = useState<TempMessagePayload | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const timeoutRef = useRef<number | null>(null)

  const startX = useRef(0)
  const startY = useRef(0)

  const isMobile = window.innerWidth <= 768

  useEffect(() => {

    return registerTempMessageHandler((payload) => {

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      setOffset({ x: 0, y: 0 })
      setCurrent(payload)

      timeoutRef.current = window.setTimeout(() => {
        setCurrent(null)
      }, payload.durationMs ?? 2500)

    })

  }, [])

  function closeToast() {
    setCurrent(null)
  }

  function handleTouchStart(e: React.TouchEvent) {

    setDragging(true)

    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY

  }

  function handleTouchMove(e: React.TouchEvent) {

    if (!dragging) return

    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    setOffset({ x: dx, y: dy })

  }

  function handleTouchEnd() {

    setDragging(false)

    if (
      Math.abs(offset.x) > 80 ||
      offset.y < -60
    ) {
      closeToast()
      return
    }

    setOffset({ x: 0, y: 0 })

  }

  if (!current) return null

  return createPortal(

    <div
      className={`${styles.toast} ${styles[current.type]} ${dragging ? styles.dragging : ''}`}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >

      <div className={styles.content}>
        <AppIcon
          name={current.type}
          className={styles.icon}
        />

        <span className={styles.message}>
          {current.message}
        </span>
      </div>

      {!isMobile && (
        <button
          className={styles.closeButton}
          onClick={closeToast}
        >
          ×
        </button>
      )}

    </div>,

    document.body,
  )
}