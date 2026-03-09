import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'

interface Props {
  type: string
  size: string
}

export function MonumentSection({
  type,
  size,
}: Props) {
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Монумент</h2>

      <div className={layout.grid2}>
        <div className={layout.field}>
          <span className={layout.label}>Тип</span>
          <span className={layout.value}>{type ? `${type}` : '—'}</span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Размер</span>
          <span className={layout.value}>{size ? `${size}` : '—'}</span>
        </div>
      </div>
    </section>
  )
}