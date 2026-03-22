import { useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../api/notifications.api'
import type {
  NotificationFilter,
  NotificationResponseDto,
} from '../types/notifications.types'
import type { PagingResponse } from '@/shared/types/api'
import { useEffect } from 'react'
import { useNotificationsStore } from '../store/notifications.store'

interface Params {
  filter: NotificationFilter
  page: number
  pageSize: number
}

export function useNotifications({ filter, page, pageSize }: Params) {
    const queryClient = useQueryClient()
    const storeNotifications = useNotificationsStore((s) => s.notifications)

    const query = useQuery<PagingResponse<NotificationResponseDto>>({
        queryKey: ['notifications', filter, page, pageSize],
        queryFn: async () => {
            console.log('[Notifications DEBUG] fetch', { filter, page })
            return notificationsApi.getNotifications(filter, page, pageSize)
        },
        placeholderData: (prev) => prev,
    })

    const countsQuery = useQuery({
        queryKey: ['notifications-counts'],
        queryFn: () => notificationsApi.getCounts(),
        staleTime: 30 * 1000, 
    })

    useEffect(() => {
        if (storeNotifications.length === 0) return
        console.log('[Notifications DEBUG] invalidate')
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