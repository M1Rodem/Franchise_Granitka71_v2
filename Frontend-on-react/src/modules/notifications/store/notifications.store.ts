import { create } from 'zustand'
import type {
  NotificationResponseDto,
  NotificationBadgeDto,
} from '../types/notifications.types'
import { NotificationStatus } from '../types/notifications.types'

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

  // REALTIME
  handleNewNotification: (item: NotificationResponseDto) => void
  handleUpdateNotification: (item: NotificationResponseDto) => void
  handleResolved: (payload: {
    notificationId: number
    status: NotificationStatus
  }) => void
  handlePostponed: (payload: {
    notificationId: number
    returnsAt: string
  }) => void
  handleBadgeUpdate: (badge: NotificationBadgeDto) => void
  handleInitialState: (unreadCount: number) => void
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

    // ===== REALTIME =====

    handleNewNotification: (item) => {
      set((state) => {
        const exists = state.notifications.some((n) => n.id === item.id)
        if (exists) return state

        return {
          notifications: [item, ...state.notifications],
        }
      })
    },

    handleUpdateNotification: (item) => {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === item.id ? item : n
        ),
      }))
    },

    handleResolved: ({ notificationId, status }) => {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, status } : n
        ),
      }))
    },

    handlePostponed: ({ notificationId, returnsAt }) => {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId
            ? {
                ...n,
                status: NotificationStatus.Postponed,
                returnsAt,
              }
            : n
        ),
      }))
    },

    handleBadgeUpdate: (badge) => {
      set({ badge })
    },

    handleInitialState: (unreadCount) => {
      set({
        badge: {
          count: unreadCount,
          color: unreadCount > 0 ? 'red' : 'none',
        },
      })
    },
}))