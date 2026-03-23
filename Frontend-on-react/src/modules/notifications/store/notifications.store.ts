import { create } from 'zustand'
import type {
  NotificationResponseDto,
  NotificationBadgeDto,
} from '../types/notifications.types'
import { NotificationStatus } from '../types/notifications.types'
import { showTempMessage } from '@/shared/ui/temp-message.service'

interface NotificationsState {
  notifications: NotificationResponseDto[]
  badge: NotificationBadgeDto | null
  loading: boolean
  setNotifications: (items: NotificationResponseDto[]) => void
  updateNotification: (item: NotificationResponseDto) => void
  removeNotification: (id: number) => void
  setBadge: (badge: NotificationBadgeDto) => void
  setLoading: (value: boolean) => void
  countByStatus: (status: NotificationStatus) => number
  unreadCount: () => number
  selectTotalCount: () => number
  selectBadgeColor: () => 'red' | 'blue' | 'gray' | 'none'
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
  handleInitialState: (badge: NotificationBadgeDto) => void
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  badge: null,
  loading: false,

  setNotifications: (items) => {
    set({ notifications: items })
  },

  updateNotification: (item) => {
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === item.id ? item : notification
      ),
    }))
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id),
    }))
  },

  setBadge: (badge) => {
    set({ badge })
  },

  setLoading: (value) => {
    set({ loading: value })
  },

  countByStatus: (status) => {
    return get().notifications.filter((notification) => notification.status === status).length
  },

  unreadCount: () => {
    return get().notifications.filter(
      (notification) => notification.status === NotificationStatus.Pending
    ).length
  },

  handleNewNotification: (item) => {
    const exists = get().notifications.some((notification) => notification.id === item.id)
    if (exists) return

    console.info('[NOTIFICATION] Received', { id: item.id, type: item.type })
    showTempMessage('info', 'У вас новое уведомление')

    set((state) => ({
      notifications: [item, ...state.notifications],
    }))
  },

  handleUpdateNotification: (item) => {
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === item.id ? item : notification
      ),
    }))
  },

  handleResolved: ({ notificationId, status }) => {
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, status } : notification
      ),
    }))
  },

  handlePostponed: ({ notificationId, returnsAt }) => {
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              status: NotificationStatus.Postponed,
              returnsAt,
            }
          : notification
      ),
    }))
  },

  handleBadgeUpdate: (badge) => {
    set({ badge })
  },

  handleInitialState: (badge) => {
    set({ badge })
  },

  selectTotalCount: () => {
    return get().badge?.count ?? 0
  },

  selectBadgeColor: () => {
    return get().badge?.color ?? 'none'
  },
}))
