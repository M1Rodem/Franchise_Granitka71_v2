import surface from '@/shared/ui/surface.module.css'
import styles from './MediaSection.module.css'
import { MediaGallery } from '@/shared/lib/media'

interface Props {
  items: any[]
}

export function MediaSection({ items }: Props) {
  const regularPhotos = items.filter((item) => !item.isOriginal)
  const originalPhotos = items.filter((item) => item.isOriginal === true)

  return (
    <section className={surface.surface}>
      <header className={styles.header}>
        <div>
          <h2 className={surface.sectionTitle}>Медиафайлы</h2>
        </div>
      </header>

      {regularPhotos.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              Фотографии и видео
            </h3>
          </div>

          <p className={styles.sectionDescription}>
            Файлы, используемые для просмотра заказа.
          </p>

          <MediaGallery items={regularPhotos} />
        </section>
      )}

      {originalPhotos.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              Оригинальные фотографии
            </h3>
          </div>

          <p className={styles.sectionDescription}>
            Фотографии без сжатия, используемые при изготовлении памятника.
          </p>

          <MediaGallery items={originalPhotos} />
        </section>
      )}

      {items.length === 0 && (
        <div className={styles.empty}>
          <h3>Медиа отсутствуют</h3>

          <p>
            Для данного заказа еще не загружены фотографии
            или видеоматериалы.
          </p>
        </div>
      )}
    </section>
  )
}