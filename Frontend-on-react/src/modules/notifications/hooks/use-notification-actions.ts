import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications.api';
import { notificationsKeys } from '../lib/notifications.keys';
import { useNotificationsStore } from '../store/notifications.store';
import { useNotificationBadgeStore } from '../store/notification-badge.store';

export function useNotificationActions() {
  const queryClient = useQueryClient();
  const removeNotification = useNotificationsStore((state) => state.removeNotification);
  const updateNotification = useNotificationsStore((state) => state.updateNotification);
  const setUnreadCount = useNotificationBadgeStore((state) => state.setUnreadCount);

  // ===== RESOLVE (approve/reject) =====
  const resolveMutation = useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: 'approved' | 'rejected';
      note?: string;
    }) => notificationsApi.resolve(id, { status, note }),
    
    onSuccess: (data, variables) => {
      // 1. Оптимистично обновляем статус в сторе
      updateNotification(variables.id, { 
        status: variables.status 
      });
      
      // 2. Инвалидируем список (чтобы получить актуальные данные)
      queryClient.invalidateQueries({ 
        queryKey: notificationsKeys.lists() 
      });
      
      // 3. Обновляем счетчик
      queryClient.invalidateQueries({ 
        queryKey: notificationsKeys.count() 
      });
    },
  });

  // ===== POSTPONE (snooze) =====
  const postponeMutation = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes?: number }) =>
      notificationsApi.postpone(id, minutes),
    
    onSuccess: (data, variables) => {
      // 1. Оптимистично обновляем статус
      updateNotification(variables.id, { 
        status: 'snoozed' 
      });
      
      // 2. Инвалидируем список
      queryClient.invalidateQueries({ 
        queryKey: notificationsKeys.lists() 
      });
      
      // 3. Обновляем счетчик
      queryClient.invalidateQueries({ 
        queryKey: notificationsKeys.count() 
      });
    },
  });

  // ===== MARK AS READ =====
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => {
      // TODO: если есть API для markAsRead
      return Promise.resolve({ success: true });
    },
    
    onSuccess: (_, id) => {
      // Обновляем счетчик (уменьшаем на 1)
      setUnreadCount(Math.max(0, useNotificationBadgeStore.getState().unreadCount - 1));
    },
  });

  return {
    // Методы
    approve: (id: string, note?: string) => 
      resolveMutation.mutate({ id, status: 'approved', note }),
    
    reject: (id: string, note?: string) => 
      resolveMutation.mutate({ id, status: 'rejected', note }),
    
    snooze: (id: string, minutes?: number) => 
      postponeMutation.mutate({ id, minutes }),
    
    markAsRead: (id: string) => markAsReadMutation.mutate(id),
    
    // Состояния загрузки
    isApproving: resolveMutation.isPending,
    isRejecting: resolveMutation.isPending,
    isSnoozing: postponeMutation.isPending,
  };
}