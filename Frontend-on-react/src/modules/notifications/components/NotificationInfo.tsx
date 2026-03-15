import layout from '@/shared/ui/form-layout.module.css'
import type { NotificationItem } from '../types/notification.types'

interface Props {
  notification: NotificationItem
}

export function NotificationInfo({ notification }: Props) {

  return (

    <div className={layout.grid2x2}>

      <div className={layout.field}>
        <div className={layout.label}>Инициатор</div>
        <div className={layout.value}>
          {notification.initiatorName}
        </div>
      </div>

      <div className={layout.field}>
        <div className={layout.label}>Получатель</div>
        <div className={layout.value}>
          {notification.userName}
        </div>
      </div>

      <div className={layout.field}>
        <div className={layout.label}>Заказ</div>
        <div className={layout.value}>
          {notification.orderNumber}
        </div>
      </div>

      <div className={layout.field}>
        <div className={layout.label}>Дата</div>
        <div className={layout.value}>
          {new Date(notification.createdAt).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>

    </div>

  )
}