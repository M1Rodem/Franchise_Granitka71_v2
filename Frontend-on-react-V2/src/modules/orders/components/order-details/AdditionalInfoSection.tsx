import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'

interface Props {
  additionalInfo: string
}

export function AdditionalInfoSection({ additionalInfo }: Props) {
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Дополнительно</h2>

      <div className={layout.grid2}>
        <div className={layout.field} style={{ gridColumn: '1 / -1' }}>
          <span className={layout.label}>Комментарий</span>
          <span className={layout.value}>
            {additionalInfo || '—'}
          </span>
        </div>
      </div>
    </section>
  )
}