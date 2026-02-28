import surface from '@/shared/ui/surface.module.css'

interface MediaItem {
  id: number
  url: string
  originalFileName: string
  width: number
  height: number
  mediaType: number | string
}

interface Props {
  items: MediaItem[]
}

function isVideo(type: number | string) {
  return String(type).toLowerCase().includes('video') || type === 1
}

export function MediaSection({ items }: Props) {
  if (!items || items.length === 0) {
    return (
      <section className={surface.surface}>
        <h2 className={surface.sectionTitle}>Медиафайлы</h2>
        <div style={{ opacity: 0.7 }}>Медиафайлы отсутствуют</div>
      </section>
    )
  }

  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Медиафайлы</h2>

      <div
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '14px',
              border: '1px solid rgba(125,162,219,0.25)',
              background: 'rgba(10,29,57,0.6)',
              aspectRatio: '1 / 1',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            {isVideo(item.mediaType) ? (
              <video
                src={item.url}
                controls
                preload="metadata"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <img
                src={item.url}
                alt={item.originalFileName}
                loading="lazy"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}