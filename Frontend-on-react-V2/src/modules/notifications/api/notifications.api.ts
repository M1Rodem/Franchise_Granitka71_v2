import { httpClient } from '@/shared/api/http-client'
import type {
  NotificationResponseDto,
  NotificationDetailsDto,
  NotificationBadgeDto,
  NotificationFilter,
  ResolveNotificationRequest,
} from '../types/notifications.types'
import type { PagingResponse } from '@/shared/types/api'
import type { NotificationCountsDto } from '../store/notifications.store'

export const notificationsApi = {
  async getNotifications(
    status: NotificationFilter,
    page: number,
    pageSize: number
  ): Promise<PagingResponse<NotificationResponseDto>> {
    const response = await httpClient.get('/Notifications/list', {
      params: {
        status,
        page,
        pageSize,
      },
    })
    return response.data
  },

  async getNotificationDetails(id: number): Promise<NotificationDetailsDto> {
    const response = await httpClient.get(`/Notifications/${id}`)
    return response.data
  },

  async resolveNotification(
    id: number,
    payload: ResolveNotificationRequest
  ): Promise<{
  success: boolean
  notification: NotificationResponseDto
  }> {
    const response = await httpClient.post(
      `/Notifications/${id}/resolve`,
      payload
    )
    return response.data
  },

  async postponeNotification(
    id: number,
    minutes: number
  ): Promise<{
    success: boolean
    notification: NotificationResponseDto
  }> {
    const response = await httpClient.post(
      `/Notifications/${id}/postpone`,
      null,
      {
        params: { minutes },
      }
    )
    return response.data
  },

  async getBadge(): Promise<NotificationBadgeDto> {
    const response = await httpClient.get('/Notifications/count')
    return response.data
  },

  async getCounts(): Promise<NotificationCountsDto> {
    const response = await httpClient.get('/Notifications/counts')
    return response.data
  }
}