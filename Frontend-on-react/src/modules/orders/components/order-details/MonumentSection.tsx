import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'

interface Props {
  type: string
  size: string
  additionalInfo: string
}

export function MonumentSection({
  type,
  size,
  additionalInfo,
}: Props) {
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Монумент</h2>

      <div className={layout.grid2}>
        <div className={layout.field}>
          <span className={layout.label}>Тип</span>
          <span className={layout.value}>{type}</span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Размер</span>
          <span className={layout.value}>{size}</span>
        </div>

        <div className={layout.field} style={{ gridColumn: '1 / -1' }}>
          <span className={layout.label}>Дополнительно</span>
          <span className={layout.value}>
            {additionalInfo || '—'}
          </span>
        </div>
      </div>
    </section>
  )
}