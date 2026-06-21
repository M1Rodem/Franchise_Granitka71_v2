import { useEffect, useState } from 'react'
import type { MediaDto } from '../api/media.types'
import { useVideoThumbnail } from '../hooks/useVideoThumbnail'
import { loadMedia } from '../utils/media-loader'
import styles from './media-item.module.css'

interface Props {
  item: MediaDto
  onClick: () => void
}

function isVideo(type: number | string) {
  return Number(type) === 1
}

export function MediaItem({ item, onClick }: Props) {
  const video = isVideo(item.mediaType)

  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (src) return

    let mounted = true

    loadMedia(item.url).then((url) => {
      if (mounted) setSrc(url)
    })

    return () => {
      mounted = false
    }
  }, [item.url, src])

  // хук вызывается ВСЕГДА
  const thumbnail = useVideoThumbnail(video ? src : null)

  return (
    <div
      className={styles.item}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {video ? (
        thumbnail ? (
          <img
            src={thumbnail}
            alt={item.originalFileName}
            className={styles.preview}
          />
        ) : (
          <div className={styles.loading}>Loading...</div>
        )
      ) : src ? (
        <img
          src={src}
          alt={item.originalFileName}
          loading="lazy"
          className={styles.preview}
        />
      ) : (
        <div className={styles.loading}>Loading...</div>
      )}

      {video && <div className={styles.videoBadge}>▶</div>}
    </div>
  )
}