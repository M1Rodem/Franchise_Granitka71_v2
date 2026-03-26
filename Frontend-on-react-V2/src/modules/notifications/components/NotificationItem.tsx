import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { NotificationResponseDto } from '../types/notifications.types'
import { NotificationStatus } from '../types/notifications.types'
import button from '@/shared/ui/button.module.css'
import { formatNotificationDateTime } from '../utils/date'
import { NotificationModal } from './NotificationModal'
import { useNotificationActions } from '../hooks/useNotificationActions'
import { isSystemNotification } from '../utils/notification-type'
import styles from './notification-item.module.css'

interface Props {
  notification: NotificationResponseDto
}

export function NotificationItem({ notification }: Props) {
  const [open, setOpen] = useState(false)

  const isSystem = notification.isInformation || isSystemNotification(notification.type)
  const isPostponed = notification.status === NotificationStatus.Postponed
  const isActive = notification.status === NotificationStatus.Pending && !isSystem

  const cardClassName = [
    styles.card,
    isActive ? styles.active : '',
    isPostponed ? styles.postponed : '',
    isSystem ? styles.system : '',
  ].join(' ')

  const { snooze, accept } = useNotificationActions({
    notificationId: notification.id,
  })

  const badges = useMemo(() => {
    const result: Array<{ label: string; className: string }> = []

    if (isActive) {
      result.push({ label: 'Активное', className: `${styles.chip} ${styles.chipActive}` })
    }

    if (isPostponed) {
      result.push({ label: 'Отложено', className: `${styles.chip} ${styles.chipPostponed}` })
    }

    if (isSystem) {
      result.push({ label: 'Системное', className: `${styles.chip} ${styles.chipSystem}` })
    }

    if (notification.isBlocking) {
      result.push({ label: 'Блокирует', className: `${styles.chip} ${styles.chipActive}` })
    }

    return result
  }, [isActive, isPostponed, isSystem, notification.isBlocking])

  return (
    <>
      <motion.div
        className={cardClassName}
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h3 className={styles.title}>{notification.title}</h3>

            {badges.length > 0 && (
              <div className={styles.badges}>
                {badges.map((badge) => (
                  <span key={badge.label} className={badge.className}>
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <span className={styles.meta}>
            {formatNotificationDateTime(notification.createdAt)}
          </span>
        </div>

        <div className={styles.message}>{notification.message}</div>

        <div className={styles.footer}>
          <span className={styles.context}>
            Заказ #{notification.orderNumber || notification.orderId || '—'}
          </span>

          {notification.status === NotificationStatus.Pending && (
            <div className={styles.actions}>
              {isSystem ? (
                <button
                  type="button"
                  className={`${button.btn} ${button.btnPrimary}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    accept()
                  }}
                >
                  Прочитано
                </button>
              ) : (
                notification.canPostpone && (
                  <button
                    type="button"
                    className={`${button.btn} ${button.btnWarning}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      snooze(30)
                    }}
                  >
                    Отложить
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </motion.div>

      <NotificationModal
        notification={notification}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
