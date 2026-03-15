import { create } from 'zustand'

export type NotificationBadgeType =
  | 'none'
  | 'system'
  | 'snoozed'
  | 'impact'

interface NotificationBadgeState {
  unreadCount: number
  badgeType: NotificationBadgeType
  isRealtimeConnected: boolean

  setUnreadCount: (count: number) => void
  setBadgeType: (type: NotificationBadgeType) => void

  incrementUnread: () => void
  setRealtimeConnected: (isConnected: boolean) => void
}

export const useNotificationBadgeStore = create<NotificationBadgeState>((set) => ({
  unreadCount: 0,
  badgeType: 'none',
  isRealtimeConnected: false,

  setUnreadCount: (count) =>
    set({ unreadCount: Math.max(0, count) }),

  setBadgeType: (type) =>
    set({ badgeType: type }),

  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),

  setRealtimeConnected: (isConnected) =>
    set({ isRealtimeConnected: isConnected }),
}))