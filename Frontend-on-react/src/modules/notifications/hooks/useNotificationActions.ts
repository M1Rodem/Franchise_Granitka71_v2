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
  const getStore = () => useNotificationsStore.getState()
  const getCurrent = () =>
    useNotificationsStore.getState().notifications.find(
      (n) => n.id === notificationId
    )

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
      console.info('[NOTIFICATION] Action', {
        action: payload.status,
        id: notificationId,
      })

      const prev = getCurrent()
      if (!prev) return

      getStore().upsertNotification({
        ...prev,
        status:
          payload.status === 'Approved'
            ? NotificationStatus.Approved
            : NotificationStatus.Rejected,
        updatedAt: new Date(Date.now() + 1).toISOString(),
      })

      return { prev }
    },

    onError: (error, _, context) => {
      console.error('[NOTIFICATION] Error', { id: notificationId, error })

      if (context?.prev) {
        store.updateNotification(context.prev)
      }

      showTempMessage('error', 'Ошибка обработки уведомления')
    },

    onSuccess: (response) => {
      showTempMessage('success', 'Уведомление обработано')

      const store = useNotificationsStore.getState()

      if (response?.notification) {
        store.upsertNotification(response.notification)
      }

      store.removeNotification(notificationId)
    },
  })

  const snoozeMutation = useMutation({
    mutationFn: (minutes: number) =>
      notificationsApi.postponeNotification(notificationId, minutes),

    onMutate: async (minutes) => {
      console.info('[NOTIFICATION] Action', {
        action: `snooze:${minutes}`,
        id: notificationId,
      })

      const prev = getStore().notifications.find(
        (n) => n.id === notificationId
      )
      if (!prev) return

      const returnsAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()

      getStore().upsertNotification({
        ...prev,
        status: NotificationStatus.Postponed,
        returnsAt,
        updatedAt: new Date(Date.now() + 1).toISOString(),
      })

      return { prev }
    },

    onError: (error, _, context) => {
      console.error('[NOTIFICATION] Error', { id: notificationId, error })

      if (context?.prev) {
        store.updateNotification(context.prev)
      }

      showTempMessage('error', 'Ошибка отложения уведомления')
    },

    onSuccess: (response) => {
      showTempMessage('success', 'Уведомление отложено')

      if (response?.notification) {
        useNotificationsStore
          .getState()
          .upsertNotification(response.notification)
      }
    },
  })

  return {
    accept: (note?: string) => resolveMutation.mutate({ status: 'Approved', note }),
    reject: (note?: string) => resolveMutation.mutate({ status: 'Rejected', note }),
    snooze: (minutes: number) => snoozeMutation.mutate(minutes),
    isLoading: resolveMutation.isPending || snoozeMutation.isPending,
  }
}
