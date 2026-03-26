import styles from './notification-badge.module.css'
import { useNotificationsStore } from '@/modules/notifications/store/notifications.store'

interface Props {
  count?: number
  color?: 'red' | 'blue' | 'gray' | 'none'
}

export function NotificationBadge(props: Props) {
  const storeCount = useNotificationsStore((s) => s.selectSidebarCount())
  const storeColor = useNotificationsStore((s) => s.selectSidebarColor())

  const count = props.count ?? storeCount
  const color = props.color ?? storeColor

  console.debug('[Notifications DEBUG][BADGE_RENDER]', {
    count,
    color,
  })

  if (!count) return null

  return (
    <span className={[styles.badge, styles[color]].join(' ')}>
      {count > 99 ? '99+' : count}
    </span>
  )
}