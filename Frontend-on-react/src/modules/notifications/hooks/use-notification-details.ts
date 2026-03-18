import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications.api';
import { notificationsKeys } from '../lib/notifications.keys';
import { useNotificationsStore } from '../store/notifications.store';
import { useEffect } from 'react';

export function useNotificationDetails(id: string | null) {
  const setCurrentNotificationDetails = useNotificationsStore(
    (state) => state.setCurrentNotificationDetails
  );
  const setDetailsLoading = useNotificationsStore((state) => state.setDetailsLoading);

  const query = useQuery({
    queryKey: notificationsKeys.detail(id || ''),
    queryFn: () => notificationsApi.getDetails(id!),
    enabled: !!id, // Запрос только если есть id
  });

  // Синхронизируем с store
  useEffect(() => {
    setDetailsLoading(query.isLoading);
    
    if (query.data) {
      setCurrentNotificationDetails(query.data);
    } else if (query.error) {
      setCurrentNotificationDetails(null);
    }
  }, [query.data, query.isLoading, query.error, setCurrentNotificationDetails, setDetailsLoading]);

  return query;
}