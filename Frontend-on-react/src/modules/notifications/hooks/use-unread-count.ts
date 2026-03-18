import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications.api';
import { notificationsKeys } from '../lib/notifications.keys';
import { useNotificationBadgeStore } from '../store/notification-badge.store';
import { useEffect } from 'react';

export function useUnreadCount() {
  const setUnreadCount = useNotificationBadgeStore((state) => state.setUnreadCount);

  const query = useQuery({
    queryKey: notificationsKeys.count(),
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 60000, // Обновляем каждую минуту
  });

  // Синхронизируем с badge store
  useEffect(() => {
    if (query.data) {
      setUnreadCount(query.data.count);
    }
  }, [query.data, setUnreadCount]);

  return query;
}