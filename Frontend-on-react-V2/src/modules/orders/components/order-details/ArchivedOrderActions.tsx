import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ordersApi } from '@/modules/orders/api/orders.api'
import { ordersKeys } from '@/modules/orders/lib/orders.keys'

import { showTempMessage } from '@/shared/ui/temp-message.service'
import { useConfirmModalStore } from '@/shared/ui/modal/modal.store'

import surface from '@/shared/ui/surface.module.css'
import button from '@/shared/ui/button.module.css'

import { isAxiosError } from 'axios'
import type { ApiErrorResponse } from '@/shared/types/api'

interface Props {
  orderId: number
}

export function ArchivedOrderActions({ orderId }: Props) {

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const openModal = useConfirmModalStore((s) => s.open)

  const restoreMutation = useMutation({
    mutationFn: () => ordersApi.restoreOrder(orderId),

    onSuccess: () => {
      showTempMessage('success', 'Заказ восстановлен')

      queryClient.invalidateQueries({ queryKey: ordersKeys.all })

      navigate(`/orders/${orderId}`)
    },

    onError: (_: unknown) => {
      showTempMessage('error', 'Ошибка восстановления заказа')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => ordersApi.deleteArchivedOrder(orderId),

    onSuccess: () => {
      showTempMessage('success', 'Заказ полностью удалён')

      queryClient.invalidateQueries({ queryKey: ordersKeys.all })

      navigate('/orders/archived')
    },

    onError: (error: unknown) => {
      if (isAxiosError<ApiErrorResponse>(error)) {
        let serverMessage = error.response?.data?.message

        if (serverMessage && typeof serverMessage === 'string') {
          // Убираем часть "Осталось X минут"
          serverMessage = serverMessage.replace(/\.\s*Осталось\s+[-\d]+\s*минут\.?/i, '')
          serverMessage = serverMessage.replace(/\s+Осталось\s+[-\d]+\s*минут\.?/i, '')

          showTempMessage('error', serverMessage.trim())
          return
        }

        if (error.response?.status === 403) {
          showTempMessage('error', 'Нет доступа к этому заказу')
          return
        }
      }

      showTempMessage('error', 'Ошибка удаления заказа')
    },
  })

  function handleRestore() {
    openModal({
      title: 'Восстановление заказа',
      message: 'Вы действительно хотите восстановить этот заказ?',
      confirmText: 'Восстановить',
      cancelText: 'Отмена',

      onConfirm: () => {
        restoreMutation.mutate()
      },
    })
  }

  function handleDelete() {
    openModal({
      title: 'Удаление заказа',
      message: 'Заказ будет удалён окончательно. Это действие нельзя отменить.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',

      onConfirm: () => {
        deleteMutation.mutate()
      },
    })
  }

  return (
    <section className={surface.surface}>

      <h2 className={surface.sectionTitle}>
        Действия
      </h2>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>

        <button
          type="button"
          className={`${button.btn} ${button.btnPrimary}`}
          onClick={handleRestore}
          disabled={restoreMutation.isPending}
        >
          {restoreMutation.isPending
            ? 'Восстановление...'
            : 'Восстановить'}
        </button>

        <button
          type="button"
          className={`${button.btn} ${button.btnDanger}`}
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending
            ? 'Удаление...'
            : 'Удалить навсегда'}
        </button>

      </div>

    </section>
  )
}