import { useEffect } from 'react'
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
  const storeNotifications = useNotificationsStore((s) => s.notifications)

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

  const aggregation = storeNotifications.reduce(
    (acc, n) => {
      if (n.isActionRequired) acc.hasActionRequired = true
      if (n.status === NotificationStatus.Postponed) acc.hasPostponed = true
      if (n.isInformation) acc.hasInformation = true
      return acc
    },
    {
      hasActionRequired: false,
      hasPostponed: false,
      hasInformation: false,
    }
  )

  const filteredItems = query.data?.items ?? []

  return {
    items: filteredItems,
    totalPages: query.data?.totalPages ?? 0,
    total: query.data?.totalCount ?? 0,
    isLoading: query.isLoading,
    aggregation,
  }
}