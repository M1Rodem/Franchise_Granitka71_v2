import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '../api/notifications.api'
import type {
  NotificationFilter,
  NotificationResponseDto,
} from '../types/notifications.types'
import type { PagingResponse } from '@/shared/types/api'
import { useNotificationsStore } from '../store/notifications.store'
import { NotificationStatus } from '../types/notifications.types'

interface Params {
  filter: NotificationFilter
  page: number
  pageSize: number
}

export function useNotifications({ filter, page, pageSize }: Params) {
  const query = useQuery<PagingResponse<NotificationResponseDto>>({
    queryKey: ['notifications', filter, page, pageSize],
    queryFn: () => notificationsApi.getNotifications(filter, page, pageSize),
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    // грузим все группы ОДИН раз
    notificationsApi.getNotifications('postponed', 1, 20)
      .then(res => {
        const store = useNotificationsStore.getState()
        res.items.forEach(item => store.upsertNotification(item))
      })

    notificationsApi.getNotifications('all', 1, 20)
      .then(res => {
        const store = useNotificationsStore.getState()
        res.items.forEach(item => store.upsertNotification(item))
      })
  }, [])
  
  useEffect(() => {
    if (!query.data) return

    const store = useNotificationsStore.getState()

    query.data.items.forEach((item) => {
      store.upsertNotification(item)
    })
  }, [query.data])

  const notifications = useNotificationsStore((s) => s.notifications)

  const active = useMemo(
    () => notifications.filter(n => n.status === NotificationStatus.Pending),
    [notifications]
  )

  const postponed = useMemo(
    () => notifications.filter(n => n.status === NotificationStatus.Postponed),
    [notifications]
  )

  const history = useMemo(
    () =>
      notifications.filter(
        (n) =>
          n.status === NotificationStatus.Approved ||
          n.status === NotificationStatus.Rejected
      ),
    [notifications]
  )

  const filteredItems =
    filter === 'active'
      ? active
      : filter === 'postponed'
      ? postponed
      : history

  return {
    items: filteredItems, // из store
    totalPages: query.data?.totalPages ?? 0,
    total: query.data?.totalCount ?? 0,
    isLoading: query.isLoading,
  }
}