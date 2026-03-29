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

export function OrderActions({ orderId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const openModal = useConfirmModalStore((s) => s.open)

  const deleteMutation = useMutation({
    mutationFn: () => ordersApi.deleteOrder(orderId),
    onSuccess: () => {
      showTempMessage('success', 'Заказ успешно удалён')
      queryClient.invalidateQueries({ queryKey: ordersKeys.all })
      navigate('/orders')
    },
    onError: (error: unknown) => {
      if (isAxiosError<ApiErrorResponse>(error)) {
        const rawMessage = error.response?.data?.message ?? ''
        const message = rawMessage.toLowerCase()

        if (message.includes('свои заказы')) {
          showTempMessage('error', 'Нельзя удалить не свой заказ')
          return
        }

        if (message.includes('в архиве')) {
          showTempMessage('error', 'Нельзя удалить заказ из архива')
          return
        }

        if (error.response?.status === 403) {
          showTempMessage('error', rawMessage || 'Нет доступа')
          return
        }
      }

      showTempMessage('error', 'Ошибка при удалении заказа')
    },
  })

  function handleDelete() {
    openModal({
      title: 'Удаление заказа',
      message: 'Вы действительно хотите удалить этот заказ?',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      onConfirm: () => {
        deleteMutation.mutate()
      },
    })
  }

  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Действия</h2>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`${button.btn} ${button.btnPrimary}`}
          onClick={() => navigate(`/orders/${orderId}/edit`)}
        >
          Редактировать
        </button>

        <button
          type="button"
          className={`${button.btn} ${button.btnDanger}`}
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
        </button>
      </div>
    </section>
  )
}