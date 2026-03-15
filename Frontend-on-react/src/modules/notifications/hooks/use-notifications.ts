import { useQuery } from '@tanstack/react-query'
import { getNotifications } from '../api/notifications.api'
import type { NotificationStatusFilter } from '../lib/notification-filter-map'

export function useNotifications(status: NotificationStatusFilter) {

  return useQuery({
    queryKey: ['notifications', status],
    queryFn: () => getNotifications(status)
  })

}