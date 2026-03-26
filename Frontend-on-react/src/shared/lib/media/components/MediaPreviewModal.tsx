import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './media-preview-modal.module.css'
import type { ViewerMediaDto } from '../api/media.types'
import { loadMedia } from '../utils/media-loader'
import { AppIcon } from '@/shared/ui/AppIcon'

interface Props {
  items: ViewerMediaDto[]
  index: number | null
  onClose: () => void
  onNavigate: (index: number) => void
}

function isVideo(type: number | string) {
  return String(type).toLowerCase().includes('video') || type === 1
}

export function MediaPreviewModal({
  items,
  index,
  onClose,
  onNavigate,
}: Props) {

  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const touchStartX = useRef<number | null>(null)

  const resetView = () => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  const next = () => {
    if (index === null) return
    const nextIndex = (index + 1) % items.length
    onNavigate(nextIndex)
    resetView()
  }

  const prev = () => {
    if (index === null) return
    const prevIndex = (index - 1 + items.length) % items.length
    onNavigate(prevIndex)
    resetView()
  }

  useEffect(() => {

    if (index === null) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') onClose()
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    window.addEventListener('keydown', handler)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handler)
    }

  }, [index])

  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {

    if (index === null) {
      setSrc(null)
      return
    }

    let mounted = true

    setSrc(null)

    loadMedia(items[index].url).then((url) => {
      if (mounted) setSrc(url)
    })

    return () => {
      mounted = false
    }

  }, [index, items])

  if (index === null) return null

  const item = items[index]

  const handleWheel = (e: React.WheelEvent) => {

    if (isVideo(item.mediaType)) return

    e.preventDefault()

    const delta = -e.deltaY * 0.001

    setZoom((z) => {

      const nextZoom = z + delta

      if (nextZoom < 1) return 1
      if (nextZoom > 3) return 3

      return nextZoom
    })
  }

  const handleDoubleClick = () => {
    if (zoom === 1) setZoom(2)
    else resetView()
  }

  const handleMouseDown = (e: React.MouseEvent) => {

    if (zoom === 1) return

    dragStart.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {

    if (!dragStart.current) return

    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    })
  }

  const handleMouseUp = () => {
    dragStart.current = null
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {

    if (touchStartX.current === null) return

    const diff = e.changedTouches[0].clientX - touchStartX.current

    if (diff > 70) prev()
    if (diff < -70) next()

    touchStartX.current = null
  }

  return createPortal(

    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >

      <div
        className={styles.viewer}
        onClick={(e) => {

          const target = e.target as HTMLElement

          if (
            target.tagName !== 'IMG' &&
            target.tagName !== 'VIDEO' &&
            target.tagName !== 'BUTTON' &&
            target.tagName !== 'A' &&
            !target.closest('button') &&
            !target.closest('a')
          ) {
            onClose()
          }

        }}
      >

        {items.length > 1 && (
          <button
            onClick={prev}
            className={styles.navLeft}
          >
            <span className={styles.icon}>
              <AppIcon name="arrowLeft" />
            </span>
          </button>
        )}

        <div
          className={styles.mediaContainer}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >

          {isVideo(item.mediaType) ? (
          src && (
            <video
              src={src}
              controls
              className={styles.media}
            />
          )
        ) : (
          src && (
            <img
              src={src}
              alt=""
              draggable={false}
              className={styles.media}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transition: dragStart.current ? 'none' : 'transform 0.18s ease',
                willChange: 'transform'
              }}
            />

          ))}

        </div>

        {items.length > 1 && (
          <button
            onClick={next}
            className={styles.navRight}
          >
            <span className={styles.icon}>
              <AppIcon name="arrowRight" />
            </span>
          </button>
        )}

        {/* DOWNLOAD ICON */}
        <a
          href={item.url}
          download
          className={styles.download}
          onClick={(e) => e.stopPropagation()}
        >
          <span className={styles.icon}>
            <AppIcon name="download" />
          </span>
        </a>

      </div>

    </div>,

    document.body
  )
}