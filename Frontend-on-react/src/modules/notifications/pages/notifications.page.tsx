// src/modules/notifications/pages/notifications.page.tsx
import { useEffect } from 'react';
import { useNotificationsStore } from '../store/notifications.store';
import { notificationsApi } from '../api/notifications.api';

export function NotificationsPage() {
  const { setNotifications } = useNotificationsStore();

  useEffect(() => {
    notificationsApi.getList().then((response) => {
      // response это { items, page, pageSize, total }
      setNotifications(
        response.items, 
        response.total, 
        response.page, 
        response.pageSize
      );
    });
  }, [setNotifications]);

  return (
    <div>
      <h1>Уведомления</h1>
      {/* TODO: рендер списка */}
    </div>
  );
}