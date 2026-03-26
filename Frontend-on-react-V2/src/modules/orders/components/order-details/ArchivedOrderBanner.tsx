import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'

interface Props {
  deletedAt?: string | null
}

function calculateDaysLeft(deletedAt?: string | null) {
  if (!deletedAt) return null

  const deletedDate = new Date(deletedAt).getTime()
  const now = Date.now()

  const diffDays = Math.floor((now - deletedDate) / 86400000)

  return 14 - diffDays
}

function calculateDeleteDate(deletedAt?: string | null) {
  if (!deletedAt) return null

  const date = new Date(deletedAt)
  date.setDate(date.getDate() + 14)

  return date
}

function formatDate(date?: Date | null) {
  if (!date) return '-'

  try {
    return format(date, 'dd.MM.yyyy HH:mm', { locale: ru })
  } catch {
    return '-'
  }
}

export function ArchivedOrderBanner({ deletedAt }: Props) {

  const deletedDate = deletedAt ? new Date(deletedAt) : null
  const deleteDate = calculateDeleteDate(deletedAt)
  const daysLeft = calculateDaysLeft(deletedAt)

  return (
    <section className={surface.surface}>

      <h2 className={surface.sectionTitle}>
        Информация
      </h2>

      <div className={layout.grid2}>

        <div className={layout.field}>
          <span className={layout.label}>Статус</span>
          <span className={layout.value}>
            Заказ находится в архиве
          </span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>До удаления</span>
          <span className={layout.value}>
            {daysLeft !== null ? `${daysLeft} дн.` : '-'}
          </span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Дата удаления</span>
          <span className={layout.value}>
            {formatDate(deletedDate)}
          </span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Автоматическое удаление</span>
          <span className={layout.value}>
            {formatDate(deleteDate)}
          </span>
        </div>

      </div>

    </section>
  )
}