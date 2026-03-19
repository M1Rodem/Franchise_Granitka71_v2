import { create } from 'zustand'
import type {
  NotificationResponseDto,
  NotificationBadgeDto,
} from './notifications.types'
import { NotificationStatus } from './notifications.types'

interface NotificationsState {
  notifications: NotificationResponseDto[]
  badge: NotificationBadgeDto | null
  loading: boolean

  // actions
  setNotifications: (items: NotificationResponseDto[]) => void
  updateNotification: (item: NotificationResponseDto) => void
  removeNotification: (id: number) => void
  setBadge: (badge: NotificationBadgeDto) => void
  setLoading: (value: boolean) => void

  // selectors
  countByStatus: (status: NotificationStatus) => number
  unreadCount: () => number
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  badge: null,
  loading: false,

  // ===== ACTIONS =====

  setNotifications: (items) => {
    set({ notifications: items })
  },

  updateNotification: (item) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === item.id ? item : n
      ),
    }))
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },

  setBadge: (badge) => {
    set({ badge })
  },

  setLoading: (value) => {
    set({ loading: value })
  },

  // ===== SELECTORS =====

  countByStatus: (status) => {
    return get().notifications.filter((n) => n.status === status).length
  },

  unreadCount: () => {
    return get().notifications.filter(
        (n) => n.status === NotificationStatus.Pending
    ).length
    },
}))