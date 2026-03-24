import { create } from 'zustand'
import type {
  NotificationResponseDto,
  NotificationBadgeDto,
} from '../types/notifications.types'
import { NotificationStatus } from '../types/notifications.types'
import { showTempMessage } from '@/shared/ui/temp-message.service'

function classify(
  notification: NotificationResponseDto
): 'active' | 'postponed' | 'history' {
  switch (notification.status) {
    case NotificationStatus.Pending:
      return 'active'
    case NotificationStatus.Postponed:
      return 'postponed'
    default:
      return 'history'
  }
}

function rebuildFlat(state: {
  active: NotificationResponseDto[]
  postponed: NotificationResponseDto[]
  history: NotificationResponseDto[]
}) {
  return [...state.active, ...state.postponed, ...state.history].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

interface NotificationsState {
  active: NotificationResponseDto[]
  postponed: NotificationResponseDto[]
  history: NotificationResponseDto[]

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
  upsertNotification: (item: NotificationResponseDto) => void
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
  active: [],
  postponed: [],
  history: [],

  notifications: [],
  badge: null,
  loading: false,

  setNotifications: (items) => {
    const active: NotificationResponseDto[] = []
    const postponed: NotificationResponseDto[] = []
    const history: NotificationResponseDto[] = []

    for (const item of items) {
      const bucket = classify(item)
      if (bucket === 'active') active.push(item)
      else if (bucket === 'postponed') postponed.push(item)
      else history.push(item)
    }

    set(() => ({
      active,
      postponed,
      history,
      notifications: rebuildFlat({ active, postponed, history }),
    }))
  },

  upsertNotification: (item: NotificationResponseDto) => {
    set((state) => {
      const existing = state.notifications.find((n) => n.id === item.id)

      // защита от устаревших данных
      if (
        existing &&
        new Date(existing.updatedAt).getTime() >=
          new Date(item.updatedAt).getTime()
      ) {
        return state
      }

      const next = {
        active: state.active.filter((n) => n.id !== item.id),
        postponed: state.postponed.filter((n) => n.id !== item.id),
        history: state.history.filter((n) => n.id !== item.id),
      }

      const bucket = classify(item)
      next[bucket].unshift(item)

      return {
        ...next,
        notifications: rebuildFlat(next),
      }
    })
  },

  updateNotification: (item) => {
    get().upsertNotification(item)
  },

  removeNotification: (id) => {
    set((state) => {
      const next = {
        active: state.active.filter((n) => n.id !== id),
        postponed: state.postponed.filter((n) => n.id !== id),
        history: state.history.filter((n) => n.id !== id),
      }

      return {
        ...next,
        notifications: rebuildFlat(next),
      }
    })
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
    console.info('[NOTIFICATION] Received', { id: item.id })

    showTempMessage('info', 'У вас новое уведомление')

    get().upsertNotification(item)
  },

  handleUpdateNotification: (item) => {
    get().upsertNotification(item)
  },

  handleResolved: (payload) => {
    const existing = get().notifications.find((n) => n.id === payload.notificationId)
    if (!existing) return

    get().upsertNotification({
      ...existing,
      status: payload.status,
      updatedAt: new Date().toISOString(),
    })
  },

  handlePostponed: ({ notificationId, returnsAt }) => {
    const existing = get().notifications.find((n) => n.id === notificationId)
    if (!existing) return

    get().upsertNotification({
      ...existing,
      status: NotificationStatus.Postponed,
      returnsAt,
      updatedAt: new Date().toISOString(),
    })
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
