import type { NotificationFilter } from '../types/notifications.types'
import button from '@/shared/ui/button.module.css'
import surface from '@/shared/ui/surface.module.css'
import toolbar from '@/shared/ui/page-toolbar.module.css'
import { NotificationBadge } from '@/shared/ui/badge/NotificationBadge'
import { useNotificationsStore } from '../store/notifications.store'
import styles from './notifications-filter.module.css'

interface Props {
  value: NotificationFilter
  onChange: (value: NotificationFilter) => void
}

export function NotificationsFilter({
  value,
  onChange,
}: Props) {
  const counts = useNotificationsStore((s) => s.counts)

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
          : 'none',
    },
    {
      key: 'postponed',
      label: 'Отложенные',
      count: counts?.postponed ?? 0,
      badgeColor: counts?.hasPostponed
        ? 'blue'
        : counts?.hasOnlySystem
          ? 'gray'
          : 'none',
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
            : 'none',
    },
  ]

  return (
    <div className={surface.surface}>
      <div className={toolbar.shell}>
        <div className={toolbar.row}>
          <div className={toolbar.titleBlock}>
            <span className={toolbar.eyebrow}>Notifications</span>
            <h1 className={toolbar.heading}>Уведомления CRM</h1>
            <p className={toolbar.description}>
              Активные, отложенные и системные события по заказам.
            </p>
          </div>

          <div className={toolbar.meta}>
            <span className={toolbar.pill}>Live статус</span>
            <span className={toolbar.pill}>История действий</span>
          </div>
        </div>

        <div className={styles.controls}>
          {filters.map((filter) => {
            const isActive = value === filter.key

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => onChange(filter.key)}
                className={`${button.btn} ${isActive ? button.btnPrimary : button.btnNeutral} ${styles.filterButton}`}
              >
                <span className={styles.filterLabel}>
                  <span>{filter.label}</span>
                  <NotificationBadge
                    count={filter.count}
                    color={filter.badgeColor}
                  />
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
