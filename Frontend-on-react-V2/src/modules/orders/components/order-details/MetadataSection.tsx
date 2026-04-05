import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'

interface Props {
  manager: string
  orderDate: string
  updatedAt: string
  dateOnly?: boolean
}

function formatDate(dateString: string, dateOnly?: boolean) {
  try {
    return format(
      new Date(dateString),
      dateOnly ? 'dd.MM.yyyy' : 'dd.MM.yyyy HH:mm',
      { locale: ru }
    )
  } catch {
    return dateString
  }
}

export function MetadataSection({
  manager,
  orderDate,
  updatedAt,
  dateOnly,
}: Props) {
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Метаданные</h2>

      <div className={layout.grid2}>
        <div className={layout.field}>
          <span className={layout.label}>Менеджер</span>
          <span className={layout.value}>{manager}</span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Дата заказа</span>
          <span className={layout.value}>{formatDate(orderDate, dateOnly)}</span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Обновлён</span>
          <span className={layout.value}>{formatDate(updatedAt, dateOnly)}</span>
        </div>
      </div>
    </section>
  )
}