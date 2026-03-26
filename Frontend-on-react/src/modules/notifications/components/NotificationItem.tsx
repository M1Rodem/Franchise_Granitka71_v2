import type { NotificationResponseDto } from '../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'
import styles from '@/shared/ui/button.module.css'
import { formatNotificationDateTime } from '../utils/date'
import { useState } from 'react'
import { NotificationModal } from './NotificationModal'
import { useNotificationActions } from '../hooks/useNotificationActions'
import { isSystemNotification } from '../utils/notification-type'

interface Props {
  notification: NotificationResponseDto
}

export function NotificationItem({ notification }: Props) {
  const [open, setOpen] = useState(false)

  const isSystem = notification.isInformation

  const { snooze, accept } = useNotificationActions({
    notificationId: notification.id,
  })

  return (
    <>
      <div
        className={surfaceStyles.surface}
        onClick={() => setOpen(true)}
        style={{ cursor: 'pointer' }}
      >
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <b>{notification.title}</b>

          <span style={{ fontSize: 12, opacity: 0.7 }}>
            {formatNotificationDateTime(notification.createdAt)}
          </span>
        </div>

        {/* BODY */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span>{notification.message}</span>

          {notification.status === 0 && (
            isSystem ? (
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={(e) => {
                  e.stopPropagation()
                  accept()
                }}
              >
                Пометить как прочитанное
              </button>
            ) : (
              notification.canPostpone && (
                <button
                  className={`${styles.btn} ${styles.btnWarning}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    snooze(30)
                  }}
                >
                  Отложить
                </button>
              )
            )
          )}
        </div>
      </div>

      <NotificationModal
        notification={notification}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}