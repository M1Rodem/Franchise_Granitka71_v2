import type { NotificationResponseDto } from '../types/notifications.types'
import { NotificationItem } from './NotificationItem'
import surfaceStyles from '@/shared/ui/surface.module.css'
import { formatNotificationDate } from '../utils/date'

interface Props {
  items: NotificationResponseDto[]
}

function group(items: NotificationResponseDto[]) {
  const result: Record<string, NotificationResponseDto[]> = {}

  for (const n of items) {
    const key = formatNotificationDate(n.createdAt)

    if (!result[key]) result[key] = []
    result[key].push(n)
  }

  return result
}

export function NotificationsList({ items }: Props) {
  const grouped = group(items)

  return (
    <div>
      {Object.entries(grouped).map(([title, list]) => (
        <div key={title}>
          <div style={{ margin: '16px 0 8px' }}>
            <span className={surfaceStyles.dateGroup}>{title}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((n) => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}