import surface from '@/shared/ui/surface.module.css'
import { MediaGallery } from '@/shared/lib/media'

interface Props {
  items: any[]
}

export function MediaSection({ items }: Props) {
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Медиафайлы</h2>
      <MediaGallery
        key={items.map(i => i.id).join('-')}
        items={items}
      />
    </section>
  )
}