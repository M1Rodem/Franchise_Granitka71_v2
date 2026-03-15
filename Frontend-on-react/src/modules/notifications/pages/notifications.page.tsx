import surface from '@/shared/ui/surface.module.css'
import { NotificationList } from '../components/NotificationList'
import { useNotifications } from '../hooks/use-notifications'
import { useState, useMemo } from 'react'
import { NotificationsFilters } from '../components/NotificationsFilters'
import type { NotificationFilter } from '../types/notification-filter'
import type { NotificationItem } from '../types/notification.types'
import { notificationFilterMap } from '../lib/notification-filter-map'
import { NotificationStatus } from '../types/notification.types'

export default function NotificationsPage() {

  const [filter, setFilter] =
    useState<NotificationFilter>('active')

  // список уведомлений для текущего фильтра
  const notificationsQuery =
    useNotifications(notificationFilterMap[filter])

  // полный список для подсчёта
  const allNotificationsQuery =
    useNotifications('all')

  const notifications: NotificationItem[] =
    notificationsQuery.data?.items ?? []

  const allNotifications: NotificationItem[] =
    allNotificationsQuery.data?.items ?? []

  const counts = useMemo(() => {

    let active = 0
    let postponed = 0

    for (const n of allNotifications) {

      if (n.status === NotificationStatus.Pending) {
        active++
      }

      if (n.status === NotificationStatus.Postponed) {
        postponed++
      }

    }

    return {
      active,
      postponed,
      history: allNotifications.length
    }

  }, [allNotifications])

  if (notificationsQuery.isLoading || allNotificationsQuery.isLoading) {
    return (
      <div className={surface.surface}>
        Загрузка уведомлений...
      </div>
    )
  }

  return (

    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}
    >

      <section className={surface.surface}>
        <p>
          Центр уведомлений отображает запросы на изменения заказов,
          системные сообщения и события системы.
        </p>
      </section>

      <section className={surface.surface}>
        <NotificationsFilters
          value={filter}
          onChange={setFilter}
          counts={counts}
        />
      </section>

      <NotificationList
        notifications={notifications}
      />

    </div>

  )
}