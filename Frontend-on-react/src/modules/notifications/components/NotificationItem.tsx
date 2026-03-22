import type { NotificationResponseDto } from '../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'
import styles from '@/shared/ui/button.module.css'
import { formatNotificationDateTime } from '../utils/date'
import { useState } from 'react'
import { NotificationModal } from './NotificationModal'

interface Props {
  notification: NotificationResponseDto
}



export function NotificationItem({ notification }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
        <div
        className={surfaceStyles.surface}
        onClick={() => setOpen(true)}
        style={{ cursor: 'pointer' }}
        >
            {/* 🔹 HEADER */}
            <div
                style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                }}
            >
                <b>{notification.title}</b>

                <span style={{ fontSize: 12, opacity: 0.7 }}>
                {formatNotificationDateTime(notification.createdAt)}
                </span>
            </div>

            {/* 🔹 BODY */}
            <div
                style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginTop: 6,
                }}
            >
                <span>{notification.message}</span>

                {notification.status === 0 && notification.canPostpone && (
                <button className={`${styles.btn} ${styles.btnSecondary}`}>
                    Отложить
                </button>
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