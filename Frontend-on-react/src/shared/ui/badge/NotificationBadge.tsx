import styles from './notification-badge.module.css'

type BadgeColor = 'red' | 'blue' | 'gray' | 'none'

interface NotificationBadgeProps {
  count: number
  color: BadgeColor
}

export function NotificationBadge({
  count,
  color,
}: NotificationBadgeProps) {
  if (count <= 0 || color === 'none') return null

  console.log('[Notifications DEBUG] badge render', { count, color })

  return (
    <span
      className={[
        styles.badge,
        styles[color],
      ].join(' ')}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}