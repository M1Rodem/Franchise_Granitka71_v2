import styles from './notification-badge.module.css'
import { useNotificationsStore } from '@/modules/notifications/store/notifications.store'


export function NotificationBadge() {
  const count = useNotificationsStore((s) => s.badge?.count ?? 0)
  const color = useNotificationsStore((s) => s.badge?.color ?? 'none')

  if (!count || color === 'none') return null

  return (
    <span className={[styles.badge, styles[color]].join(' ')}>
      {count > 99 ? '99+' : count}
    </span>
  )
}