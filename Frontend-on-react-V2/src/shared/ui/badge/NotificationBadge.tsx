import { motion } from 'framer-motion'
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

  if (!count) return null

  return (
    <motion.span
      className={[
        styles.badge,
        styles[color],
        color === 'red' ? styles.attention : '',
      ].join(' ')}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        ease: 'easeOut',
      }}
    >
      {count > 99 ? '99+' : count}
    </motion.span>
  )
}
