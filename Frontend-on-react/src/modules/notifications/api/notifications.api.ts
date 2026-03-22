import { httpClient } from '@/shared/api/http-client'
import type {
  NotificationResponseDto,
  NotificationDetailsDto,
  NotificationBadgeDto,
  NotificationFilter,
  ResolveNotificationRequest,
  PostponeNotificationRequest,
} from '../types/notifications.types'
import type { PagingResponse } from '@/shared/types/api'

export const notificationsApi = {
  async getNotifications(
    status: NotificationFilter,
    page: number,
    pageSize: number
  ): Promise<PagingResponse<NotificationResponseDto>> {
    const response = await httpClient.get('/api/Notifications/list', {
      params: {
        status,
        page,
        pageSize,
      },
    })
    return response.data
  },

  async getNotificationDetails(id: number): Promise<NotificationDetailsDto> {
    const response = await httpClient.get(`/api/Notifications/${id}`)
    return response.data
  },

  async resolveNotification(
    id: number,
    payload: ResolveNotificationRequest
  ): Promise<boolean> {
    const response = await httpClient.post(
      `/api/Notifications/${id}/resolve`,
      payload
    )
    return response.data
  },

  async postponeNotification(
    id: number,
    payload: PostponeNotificationRequest
  ): Promise<boolean> {
    const response = await httpClient.post(
      `/api/Notifications/${id}/postpone`,
      payload
    )
    return response.data
  },

  async getBadge(): Promise<NotificationBadgeDto> {
    const response = await httpClient.get('/api/Notifications/count')
    return response.data
  },

  async getCounts(): Promise<{
    active: number
    postponed: number
    all: number
  }> {
    const response = await httpClient.get('/api/Notifications/counts')
    return response.data
  }
}