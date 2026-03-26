import type { NotificationFilter } from '../types/notifications.types'
import styles from '@/shared/ui/button.module.css'
import { NotificationBadge } from '@/shared/ui/badge/NotificationBadge'
import surface from '@/shared/ui/surface.module.css'
import { useNotificationsStore } from '../store/notifications.store'
import { NotificationStatus } from '../types/notifications.types'

interface Props {
  value: NotificationFilter
  onChange: (value: NotificationFilter) => void
}

export function NotificationsFilter({
  value,
  onChange,
}: Props){
  const notifications = useNotificationsStore((s) => s.notifications)

  // 1. группировки
  const active = notifications.filter(
    (n) => n.status === NotificationStatus.Pending
  )

  const postponed = notifications.filter(
    (n) => n.status === NotificationStatus.Postponed
  )

  const history = notifications.filter(
    (n) =>
      n.status === NotificationStatus.Approved ||
      n.status === NotificationStatus.Rejected
  )

  // 2. флаги
  const hasActiveNonSystem = active.some((n) => !n.isInformation)
  const hasActive = active.length > 0
  const hasPostponed = postponed.length > 0
  const hasHistory = history.length > 0

  // 3. filters
  const filters: {
    key: NotificationFilter
    label: string
    count: number
    badgeColor: 'red' | 'blue' | 'gray' | 'none'
  }[] = [
    {
      key: 'active',
      label: 'Активные',
      count: active.length,
      badgeColor: hasActiveNonSystem
        ? 'red'
        : hasActive
        ? 'gray'
        : 'none',
    },
    {
      key: 'postponed',
      label: 'Отложенные',
      count: postponed.length,
      badgeColor: hasPostponed ? 'blue' : 'none',
    },
    {
      key: 'all',
      label: 'История',
      count: history.length,
      badgeColor: hasActiveNonSystem
        ? 'red'
        : hasPostponed
        ? 'blue'
        : hasHistory
        ? 'gray'
        : 'none',
    },
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
                  isActive ? styles.btnPrimary : styles.btnNeutral
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
