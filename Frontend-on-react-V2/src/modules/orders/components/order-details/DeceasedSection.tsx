import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'

interface Props {
  deceasedFullName: string
}

export function DeceasedSection({ deceasedFullName }: Props) {
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Покойный</h2>

      <div className={layout.field}>
        <span className={layout.value} style={{ whiteSpace: 'pre-line' }}>
          {deceasedFullName}
        </span>
      </div>
    </section>
  )
}