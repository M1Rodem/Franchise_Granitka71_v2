import type { NotificationFilter } from '../types/notifications.types'
import styles from '@/shared/ui/button.module.css'
import { NotificationBadge } from '@/shared/ui/badge/NotificationBadge'
import surface from '@/shared/ui/surface.module.css'

interface Props {
  value: NotificationFilter
  onChange: (value: NotificationFilter) => void
  counts?: {
    active: number
    postponed: number
    all: number
  }
}

export function NotificationsFilter({ value, onChange, counts }: Props) {
  const activeCount = counts?.active ?? 0
  const postponedCount = counts?.postponed ?? 0
  const historyCount = (counts?.all ?? 0)

  const filters: {
    key: NotificationFilter
    label: string
    count: number
    badgeColor: 'red' | 'blue' | 'gray' | 'none'
  }[] = [
    { key: 'active', label: 'Активные', count: activeCount, badgeColor: activeCount > 0 ? 'red' : 'gray' },
    { key: 'postponed', label: 'Отложенные', count: postponedCount, badgeColor: postponedCount > 0 ? 'blue' : 'gray' },
    { key: 'all', label: 'История', count: historyCount, badgeColor: historyCount > 0 ? 'gray' : 'none' },
  ]

  return (
    <div className={surface.surface}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* LEFT */}
        <div
          style={{
            fontSize: 18,
            color: '#cfe3ff',
            opacity: 0.8,
          }}
        >
          Уведомления по заказам и изменениям
        </div>

        {/* RIGHT */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {filters.map((f) => {
            const isActive = value === f.key

            return (
              <button
                key={f.key}
                onClick={() => {
                  onChange(f.key)
                }}
                className={`${styles.btn} ${
                  isActive ? styles.btnPrimary : styles.btnSecondary
                }`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {f.label}

                <NotificationBadge
                  count={f.count}
                  color={f.badgeColor}
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
