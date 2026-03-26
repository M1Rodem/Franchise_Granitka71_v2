import { useState } from 'react'
import { NotificationsFilter } from '../components/NotificationsFilter'
import { NotificationsList } from '../components/NotificationsList'
import { useNotifications } from '../hooks/useNotifications'
import type { NotificationFilter } from '../types/notifications.types'
import paginationStyles from '../components/notifications-pagination.module.css'
import styles from './notifications.page.module.css'

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
    <div className={styles.page}>
      <NotificationsFilter
        value={filter}
        onChange={setFilter}
      />

      {isLoading ? (
        <div className={styles.loadingBlock}>
          <div className={styles.loadingRow} />
          <div className={styles.loadingRow} />
          <div className={styles.loadingRow} />
        </div>
      ) : (
        <NotificationsList items={items} />
      )}

      <div className={paginationStyles.pagination}>
        <p className={paginationStyles.meta}>Всего: {total}</p>

        <div className={paginationStyles.controls}>
          <button
            type="button"
            onClick={() => setPage((current) => current - 1)}
            disabled={page === 1}
          >
            Назад
          </button>

          <span>
            {page} / {Math.max(totalPages, 1)}
          </span>

          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={page === totalPages}
          >
            Вперёд
          </button>
        </div>
      </div>
    </div>
  )
}
