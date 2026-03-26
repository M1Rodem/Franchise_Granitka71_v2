import type { NotificationFilter } from '../types/notifications.types'
import styles from '@/shared/ui/button.module.css'
import { NotificationBadge } from '@/shared/ui/badge/NotificationBadge'
import surface from '@/shared/ui/surface.module.css'
import { useNotificationsStore } from '../store/notifications.store'

interface Props {
  value: NotificationFilter
  onChange: (value: NotificationFilter) => void
}

export function NotificationsFilter({
  value,
  onChange,
}: Props){
  const counts = useNotificationsStore((s) => s.counts)

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
      count: counts?.active ?? 0,
      badgeColor: counts?.hasActiveNonSystem
        ? 'red'
        : counts?.hasOnlySystem
        ? 'gray'
        : 'none'
    },
    {
      key: 'postponed',
      label: 'Отложенные',
      count: counts?.postponed ?? 0,
      badgeColor: counts?.hasActiveNonSystem
        ? 'blue'
        : counts?.hasOnlySystem
        ? 'gray'
        : 'none'
    },
    {
      key: 'all',
      label: 'История',
      count: counts?.all ?? 0,
      badgeColor: counts?.hasActiveNonSystem
        ? 'red'
        : counts?.hasPostponed
        ? 'blue'
        : counts?.hasOnlySystem
        ? 'gray'
        : 'none'
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
