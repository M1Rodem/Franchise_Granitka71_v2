import { create } from 'zustand';

interface NotificationBadgeState {
  unreadCount: number;
  isRealtimeConnected: boolean;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  setRealtimeConnected: (isConnected: boolean) => void;
}

export const useNotificationBadgeStore = create<NotificationBadgeState>((set) => ({
  unreadCount: 0,
  isRealtimeConnected: false,
  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  setRealtimeConnected: (isConnected) => set({ isRealtimeConnected: isConnected }),
}));
