import { httpClient } from '@/shared/api/http-client';
import type {
  NotificationDetailsDto,
  NotificationsListParams,
  NotificationsListResponse,
  UnreadCountResponse,
} from '../types/notifications.types';

const BASE_PATH = '/api/notifications';

export const notificationsApi = {
  // ===========================================
  // GET: список уведомлений
  // ===========================================
  async getList(params: NotificationsListParams = {}): Promise<NotificationsListResponse> {
    const { data } = await httpClient.get<NotificationsListResponse>(`${BASE_PATH}/list`, {
      params: {
        status: params.status ?? 'pending',
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      },
    });
    return data;
  },

  // ===========================================
  // GET: детали уведомления (с изменениями)
  // ===========================================
  async getDetails(id: string): Promise<NotificationDetailsDto> {
    const { data } = await httpClient.get<NotificationDetailsDto>(`${BASE_PATH}/${id}`);
    return data;
  },

  // ===========================================
  // GET: количество непрочитанных
  // ===========================================
  async getUnreadCount(): Promise<UnreadCountResponse> {
    const { data } = await httpClient.get<UnreadCountResponse>(`${BASE_PATH}/count`);
    return data;
  },

  // ===========================================
  // POST: принять/отклонить
  // ===========================================
  async resolve(
    id: string,
    payload: {
      status: 'approved' | 'rejected';
      note?: string;
    }
  ): Promise<{ success: boolean; message: string; notificationId: string }> {
    const { data } = await httpClient.post(`${BASE_PATH}/${id}/resolve`, payload);
    return data;
  },

  // ===========================================
  // POST: отложить
  // ===========================================
  async postpone(
    id: string,
    minutes: number = 30
  ): Promise<{ success: boolean; message: string; notificationId: string; minutes: number }> {
    const { data } = await httpClient.post(`${BASE_PATH}/${id}/postpone?minutes=${minutes}`);
    return data;
  },
};