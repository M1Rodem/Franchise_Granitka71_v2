import surface from '@/shared/ui/surface.module.css'
import button from '@/shared/ui/button.module.css'
import type { NotificationItem as Notification } from '../types/notification.types'

interface Props {
  notification: Notification
  onOpen: (notification: Notification) => void
}

export function NotificationItem({
  notification,
  onOpen
}: Props) {

  return (

    <section
      className={surface.surface}
      onClick={() => onOpen(notification)}
      style={{
        cursor: 'pointer',
        padding: '18px 22px',
        gap: '10px'
      }}
    >

      {/* HEADER */}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >

        <h3
          style={{
            margin: 0,
            fontSize: '17px',
            fontWeight: 600
          }}
        >
          {notification.title}
        </h3>

        <span
          style={{
            fontSize: '13px',
            opacity: 0.7
          }}
        >
          {new Date(notification.createdAt).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>

      </div>

      {/* MESSAGE + ACTION */}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}
      >

        <p
          style={{
            margin: 0,
            fontSize: '15px',
            lineHeight: 1.45,
            flex: 1
          }}
        >
          {notification.message}
        </p>

        {notification.canPostpone && (
          <button
            className={`${button.btn} ${button.btnSecondary}`}
            style={{
              minHeight: '36px',
              padding: '0 14px'
            }}
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            Отложить
          </button>
        )}

      </div>

    </section>

  )
}