import { useMutation } from '@tanstack/react-query'
import { notificationsApi } from '../api/notifications.api'
import { useNotificationsStore } from '../store/notifications.store'
import { NotificationStatus } from '../types/notifications.types'
import { showTempMessage } from '@/shared/ui/temp-message.service'

interface Params {
  notificationId: number
}

export function useNotificationActions({ notificationId }: Params) {
  const store = useNotificationsStore()

  const getCurrent = () =>
    store.notifications.find((n) => n.id === notificationId)

  // ===== ACCEPT / REJECT =====

  const resolveMutation = useMutation({
    mutationFn: (payload: {
      status: 'Approved' | 'Rejected'
      note?: string
    }) =>
      notificationsApi.resolveNotification(notificationId, {
        status: payload.status,
        note: payload.note,
      }),

    onMutate: async (payload) => {
      console.log('[Notifications DEBUG] resolve start', payload)

      const prev = getCurrent()
      if (!prev) return

      // optimistic
      store.handleResolved({
        notificationId,
        status:
          payload.status === 'Approved'
            ? NotificationStatus.Approved
            : NotificationStatus.Rejected,
      })

      return { prev }
    },

    onError: (error, _, context) => {
      console.log('[Notifications DEBUG] resolve error', error)

      if (context?.prev) {
        store.updateNotification(context.prev)
      }

      showTempMessage('error', 'Ошибка обработки уведомления')
    },

    onSuccess: () => {
      showTempMessage('success', 'Уведомление обработано')
    },
  })

  // ===== SNOOZE =====

  const snoozeMutation = useMutation({
    mutationFn: (minutes: number) =>
      notificationsApi.postponeNotification(notificationId, minutes),

    onMutate: async (minutes) => {
      console.log('[Notifications DEBUG] snooze start', { minutes })

      const prev = getCurrent()
      if (!prev) return

      const returnsAt = new Date(
        Date.now() + minutes * 60 * 1000
      ).toISOString()

      // optimistic
      store.handlePostponed({
        notificationId,
        returnsAt,
      })

      return { prev }
    },

    onError: (error, _, context) => {
      console.log('[Notifications DEBUG] snooze error', error)

      if (context?.prev) {
        store.updateNotification(context.prev)
      }

      showTempMessage('error', 'Ошибка отложения уведомления')
    },

    onSuccess: () => {
      showTempMessage('success', 'Уведомление отложено')
    },
  })

  return {
    accept: (note?: string) =>
      resolveMutation.mutate({ status: 'Approved', note }),

    reject: (note?: string) =>
      resolveMutation.mutate({ status: 'Rejected', note }),

    snooze: (minutes: number) => snoozeMutation.mutate(minutes),

    isLoading:
      resolveMutation.isPending || snoozeMutation.isPending,
  }
}