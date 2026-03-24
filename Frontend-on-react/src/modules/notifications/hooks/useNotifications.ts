import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '../api/notifications.api'
import type {
  NotificationFilter,
  NotificationResponseDto,
} from '../types/notifications.types'
import type { PagingResponse } from '@/shared/types/api'
import { useNotificationsStore } from '../store/notifications.store'

interface Params {
  filter: NotificationFilter
  page: number
  pageSize: number
}

export function useNotifications({ filter, page, pageSize }: Params) {
  const storeNotifications = useNotificationsStore((s) => s.notifications)
  const setNotifications = useNotificationsStore((s) => s.setNotifications)

  const query = useQuery<PagingResponse<NotificationResponseDto>>({
    queryKey: ['notifications', filter, page, pageSize],
    queryFn: () => notificationsApi.getNotifications(filter, page, pageSize),
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (!query.data) return
    setNotifications(query.data.items)
  }, [query.data, setNotifications])

  const countsQuery = useQuery({
    queryKey: ['notifications-counts'],
    queryFn: () => notificationsApi.getCounts(),
    staleTime: 30 * 1000,
  })

  return {
    items: storeNotifications,
    totalPages: query.data?.totalPages ?? 0,
    total: query.data?.totalCount ?? 0,
    isLoading: query.isLoading,
    counts: countsQuery.data,
    isLoadingCounts: countsQuery.isLoading,
  }
}