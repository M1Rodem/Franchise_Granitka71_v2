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
import type { NotificationCountsDto } from '../store/notifications.store'

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
    if (!query.data) return

    const store = useNotificationsStore.getState()

    query.data.items.forEach((item) => {
      store.upsertNotification(item)
    })
  }, [query.data])
  
  const countsQuery = useQuery<NotificationCountsDto>({
    queryKey: ['notifications-counts'],
    queryFn: () => notificationsApi.getCounts(),
    staleTime: 30 * 1000,
  })

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

  const setCounts = useNotificationsStore((s) => s.setCounts)

  useEffect(() => {
    if (!countsQuery.data) return
    setCounts(countsQuery.data as NotificationCountsDto)
  }, [countsQuery.data])

  const filteredItems = storeNotifications.filter((n) => {
    if (filter === 'active') {
      return n.status === NotificationStatus.Pending
    }

    if (filter === 'postponed') {
      return n.status === NotificationStatus.Postponed
    }

    if (filter === 'all') {
      return true
    }

    return true
  })

  return {
    items: filteredItems,
    totalPages: query.data?.totalPages ?? 0,
    total: query.data?.totalCount ?? 0,
    isLoading: query.isLoading,
    counts: countsQuery.data,
    aggregation,
    isLoadingCounts: countsQuery.isLoading,
  }
}