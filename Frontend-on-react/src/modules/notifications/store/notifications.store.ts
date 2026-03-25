import { create } from 'zustand'
import type {
  NotificationResponseDto,
} from '../types/notifications.types'
import { NotificationStatus } from '../types/notifications.types'
import { showTempMessage } from '@/shared/ui/temp-message.service'

interface NotificationsState {
  notifications: NotificationResponseDto[] 
  loading: boolean
  counts: NotificationCountsDto | null
  setNotifications: (items: NotificationResponseDto[]) => void
  updateNotification: (item: NotificationResponseDto) => void
  removeNotification: (id: number) => void
  setLoading: (value: boolean) => void
  upsertNotification: (item: NotificationResponseDto) => void
  handleNewNotification: (item: NotificationResponseDto) => void
  handleUpdateNotification: (item: NotificationResponseDto) => void
  setCounts: (counts: NotificationCountsDto) => void
  handleResolved: (payload: {
    notificationId: number
    status: NotificationStatus
  }) => void
  handlePostponed: (payload: {
    notificationId: number
    returnsAt: string
  }) => void
  selectSidebarBadge: () => {
    count: number
    color: BadgeColor
  }
  selectSidebarCount: () => number
  selectSidebarColor: () => BadgeColor
}

type BadgeColor = 'red' | 'blue' | 'gray' | 'none'

export interface NotificationCountsDto {
  active: number
  postponed: number
  history: number
  all: number

  hasActiveNonSystem: boolean
  hasPostponed: boolean
  hasOnlySystem: boolean
}

const getBadgeColor = (counts: NotificationCountsDto): BadgeColor => {
  if (counts.hasActiveNonSystem) return 'red'
  if (counts.hasPostponed) return 'blue'
  if (counts.hasOnlySystem) return 'gray'
  return 'none'
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  counts: null,
  notifications: [],
  loading: false,

  selectSidebarCount: () => {
    const c = get().counts
    return c ? c.active + c.postponed : 0
  },

  selectSidebarColor: () => {
    const c = get().counts
    if (!c) return 'none'

    if (c.hasActiveNonSystem) return 'red'
    if (c.hasPostponed) return 'blue'
    if (c.hasOnlySystem) return 'gray'

    return 'none'
  },

  setNotifications: (items) => {
    set((state) => {
      const map = new Map(state.notifications.map(n => [n.id, n]))

      items.forEach(item => {
        const existing = map.get(item.id)

        if (
          !existing ||
          new Date(existing.updatedAt).getTime() <
          new Date(item.updatedAt).getTime()
        ) {
          map.set(item.id, item)
        }
      })

      return {
        notifications: Array.from(map.values())
      }
    })
  },

  setCounts: (counts) => {
    set((state) => {
      if (
        state.counts &&
        state.counts.active === counts.active &&
        state.counts.postponed === counts.postponed &&
        state.counts.history === counts.history
      ) {
        return state
      }

      return { counts }
    })
  },

  upsertNotification: (item: NotificationResponseDto) => {
    set((state) => {
      const existing = state.notifications.find((n) => n.id === item.id)

      if (
        existing &&
        new Date(existing.updatedAt).getTime() >=
          new Date(item.updatedAt).getTime()
      ) {
        return state
      }

      const filtered = state.notifications.filter((n) => n.id !== item.id)

      return {
        notifications: [item, ...filtered].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      }
    })
  },

  updateNotification: (item) => {
    get().upsertNotification(item)
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },

  setLoading: (value) => {
    set({ loading: value })
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
    set((state) => {
      const existing = state.notifications.find((n) => n.id === notificationId)
      if (!existing) return state

      const updated = {
        ...existing,
        status: NotificationStatus.Postponed,
        returnsAt,
        updatedAt: new Date().toISOString(),
      }

      return {
        notifications: state.notifications
          .map((n) => (n.id === notificationId ? updated : n))
      }
    })
  },

  selectSidebarBadge: () => {
    const counts = get().counts
    if (!counts) return { count: 0, color: 'none' as const }

    const total = counts.active + counts.postponed

    if (total === 0) {
      return { count: 0, color: 'none' as const }
    }

    return {
      count: total,
      color: getBadgeColor(counts),
    }
  },
}))
