import { useState } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { NotificationsFilter } from '../components/NotificationsFilter'
import { NotificationsList } from '../components/NotificationsList'
import type { NotificationFilter } from '../types/notifications.types'
import paginationStyles from '../components/notifications-pagination.module.css'

export default function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilter>('active')
  const [page, setPage] = useState(1)

  const {
    items,
    totalPages,
    total,
    isLoading,
  } = useNotifications({
    filter,
    page,
    pageSize: 20,
  })

  return (
    <div>
      <NotificationsFilter
        value={filter}
        onChange={setFilter}
      />

      {isLoading && <div>Загрузка уведомлений...</div>}

      <NotificationsList items={items} />

      <div className={paginationStyles.pagination}>
        <p className={paginationStyles.meta}>
          Всего: {total}
        </p>

        <div className={paginationStyles.controls}>
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
          >
            Назад
          </button>

          <span>
            {page} / {Math.max(totalPages, 1)}
          </span>

          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages}
          >
            Вперед
          </button>
        </div>
      </div>
    </div>
  )
}