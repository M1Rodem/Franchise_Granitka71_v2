import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  const storeNotifications = useNotificationsStore((state) => state.notifications)

  const query = useQuery<PagingResponse<NotificationResponseDto>>({
    queryKey: ['notifications', filter, page, pageSize],
    queryFn: async () => notificationsApi.getNotifications(filter, page, pageSize),
    placeholderData: (prev) => prev,
  })

  const countsQuery = useQuery({
    queryKey: ['notifications-counts'],
    queryFn: () => notificationsApi.getCounts(),
    staleTime: 30 * 1000,
  })

  useEffect(() => {
    if (storeNotifications.length === 0) return
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }, [storeNotifications.length, queryClient])

  return {
    items: query.data?.items ?? [],
    totalPages: query.data?.totalPages ?? 0,
    total: query.data?.totalCount ?? 0,
    isLoading: query.isLoading,
    counts: countsQuery.data,
    isLoadingCounts: countsQuery.isLoading,
  }
}
