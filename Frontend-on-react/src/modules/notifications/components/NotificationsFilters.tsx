import button from '@/shared/ui/button.module.css'
import {
  notificationFilters,
  type NotificationFilter,
  type NotificationFilterCounts
} from '../types/notification-filter'

interface Props {
  value: NotificationFilter
  onChange: (filter: NotificationFilter) => void
  counts: NotificationFilterCounts
}

const filterLabels: Record<NotificationFilter, string> = {
  active: 'Активные',
  postponed: 'Отложенные',
  history: 'История'
}

export function NotificationsFilters({
  value,
  onChange,
  counts
}: Props) {

  return (

    <div
      style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap'
      }}
    >

      {notificationFilters.map((filter) => {

        const isActive = value === filter
        const label = filterLabels[filter]
        const count = counts[filter]

        return (
          <button
            key={filter}
            className={`${button.btn} ${
              isActive
                ? button.btnPrimary
                : button.btnSecondary
            }`}
            onClick={() => onChange(filter)}
          >
            {label} ({count})
          </button>
        )
      })}

    </div>

  )
}