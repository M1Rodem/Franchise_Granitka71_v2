import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '../api/notifications.api'

export function useNotificationsTest() {
  return useQuery({
    queryKey: ['notifications-test'],
    queryFn: async () => {
      const response = await notificationsApi.getNotifications('all', 1, 10)
      const badge = await notificationsApi.getBadge()

      if (response.items.length > 0) {
        const details = await notificationsApi.getNotificationDetails(response.items[0].id)
        return { response, badge, details }
      }

      return { response, badge, details: null }
    },
    retry: false,
  })
}
