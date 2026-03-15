import { httpClient } from '@/shared/api/http-client'
import type { NotificationItem } from '../types/notification.types'

interface NotificationsResponse {
  items: NotificationItem[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getNotifications(status: string): Promise<NotificationsResponse> {

  const { data } = await httpClient.get('/api/notifications', {
    params: { status }
  })

  return data
}

export async function getNotificationCount(): Promise<number> {

  const { data } = await httpClient.get('/api/notifications/count')

  return data.count

}

export async function resolveNotification(
  id: number,
  status: 'Approved' | 'Rejected',
  note?: string
) {

  await httpClient.post(`/api/notifications/${id}/resolve`, {
    status,
    note
  })

}

export async function postponeNotification(
  id: number,
  minutes: number
) {

  await httpClient.post(`/api/notifications/${id}/postpone`, null, {
    params: { minutes }
  })

}

