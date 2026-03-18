import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications.api';
import { notificationsKeys } from '../lib/notifications.keys';
import type { NotificationsFilterType } from '../types/notifications.types';
import { useNotificationsStore } from '../store/notifications.store';
import { useEffect } from 'react';

export function useNotificationsList(
  status: NotificationsFilterType = 'pending',
  page: number = 1,
  pageSize: number = 20
) {
  const setNotifications = useNotificationsStore((state) => state.setNotifications);

  const query = useQuery({
    queryKey: notificationsKeys.list({ status, page, pageSize }),
    queryFn: () => notificationsApi.getList({ status, page, pageSize }),
  });

  // Синхронизируем данные с Zustand store
  useEffect(() => {
    if (query.data) {
      setNotifications(
        query.data.items,
        query.data.total,
        query.data.page,
        query.data.pageSize
      );
    }
  }, [query.data, setNotifications]);

  return query;
}