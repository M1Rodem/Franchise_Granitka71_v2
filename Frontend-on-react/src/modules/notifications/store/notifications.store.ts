import { create } from 'zustand';
import type { NotificationDetailsDto, NotificationDto } from '../types/notifications.types';

interface NotificationsStore {
  // Стейт
  notifications: NotificationDto[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  
  // Детали текущего открытого уведомления
  currentNotificationId: string | null;
  currentNotificationDetails: NotificationDetailsDto | null;
  isDetailsLoading: boolean;
  
  // Блокировка UI (impact notifications)
  hasBlockingImpact: boolean;
  blockingNotificationId: string | null;
  
  // Методы
  setNotifications: (items: NotificationDto[], total: number, page: number, pageSize: number) => void;
  updateNotification: (id: string, updates: Partial<NotificationDto>) => void;
  removeNotification: (id: string) => void;
  
  setCurrentNotification: (id: string | null) => void;
  setCurrentNotificationDetails: (details: NotificationDetailsDto | null) => void;
  setDetailsLoading: (isLoading: boolean) => void;
  
  checkImpactBlock: () => void;
  clearImpactBlock: () => void;
}

export const useNotificationsStore = create<NotificationsStore>((set, get) => ({
  // Начальный стейт
  notifications: [],
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,
  
  currentNotificationId: null,
  currentNotificationDetails: null,
  isDetailsLoading: false,
  
  hasBlockingImpact: false,
  blockingNotificationId: null,
  
  // Методы
  setNotifications: (items, total, page, pageSize) => {
    set({
      notifications: items,
      totalCount: total,
      currentPage: page,
      pageSize: pageSize,
    });
    
    get().checkImpactBlock();
  },
  
  updateNotification: (id, updates) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, ...updates } : n
      ),
    }));
    
    get().checkImpactBlock();
  },
  
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      currentNotificationId: state.currentNotificationId === id ? null : state.currentNotificationId,
      currentNotificationDetails: state.currentNotificationId === id ? null : state.currentNotificationDetails,
    }));
    
    get().checkImpactBlock();
  },
  
  setCurrentNotification: (id) => {
    set({ currentNotificationId: id });
    if (!id) {
      set({ currentNotificationDetails: null });
    }
  },
  
  setCurrentNotificationDetails: (details) => {
    set({ currentNotificationDetails: details });
  },
  
  setDetailsLoading: (isLoading) => {
    set({ isDetailsLoading: isLoading });
  },
  
  checkImpactBlock: () => {
    const { notifications } = get();
    
    const activeImpact = notifications.find(
      (n) => n.type === 'impact' && !['approved', 'rejected', 'resolved'].includes(n.status)
    );
    
    set({
      hasBlockingImpact: !!activeImpact,
      blockingNotificationId: activeImpact?.id ?? null,
    });
  },
  
  clearImpactBlock: () => {
    set({ hasBlockingImpact: false, blockingNotificationId: null });
  },
}));