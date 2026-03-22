import type { MediaChangeDto } from '../../types/notifications.types'
import type { MediaDto } from '@/shared/lib/media/api/media.types'
import { MediaGallery } from '@/shared/lib/media'
import surfaceStyles from '@/shared/ui/surface.module.css'
import { env } from '@/shared/config/env'

interface Props {
  data: MediaChangeDto
}

function mapMedia(items: MediaChangeDto['addedMedia']): MediaDto[] {
  return items
    .filter((m) => m.previewUrl)
    .map((m) => {
      const url = m.previewUrl.startsWith('http')
        ? m.previewUrl
        : `${env.apiBaseUrl}${m.previewUrl}`

      console.log('[Notifications DEBUG] media url', {
        original: m.previewUrl,
        final: url,
      })

      return {
        id: m.id,
        url,
        mediaType: m.type === 'video' ? 1 : 0,

        originalFileName: '',
        size: 0,
        uploadedAt: new Date().toISOString(),
        width: 0,
        height: 0,
      }
    })
}

export function MediaDiff({ data }: Props) {
  const deleted = mapMedia(data.deletedMedia)
  const added = mapMedia(data.addedMedia)

  return (
    <div className={surfaceStyles.surface}>
      <div className={surfaceStyles.diffList} style={{ gap: 16 }}>

        {/* УДАЛЕНО */}
        <div className={surfaceStyles.diffCard}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div
              className={`${surfaceStyles.dateGroup} ${surfaceStyles.diffBadgeRemoved}`}
            >
              Будет удалено ({deleted.length})
            </div>
          </div>

          {deleted.length ? (
            <MediaGallery items={deleted} />
          ) : (
            <EmptyState />
          )}
        </div>

        {/* ДОБАВЛЕНО */}
        <div className={surfaceStyles.diffCard}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div
              className={`${surfaceStyles.dateGroup} ${surfaceStyles.diffBadgeAdded}`}
            >
              Будет добавлено ({added.length})
            </div>
          </div>

          {added.length ? (
            <MediaGallery items={added} />
          ) : (
            <EmptyState />
          )}
        </div>

      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '16px',
        opacity: 0.6,
        fontSize: 14,
      }}
    >
      Нет медиа
    </div>
  )
}