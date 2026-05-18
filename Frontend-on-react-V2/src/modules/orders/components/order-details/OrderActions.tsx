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
import { useState } from 'react'

import {
  SubmitForReviewModal,
} from '../completion/SubmitForReviewModal'

interface Props {
  orderId: number
  status: number | string
}

export function OrderActions({
  orderId,
  status,
}: Props){
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const openModal = useConfirmModalStore((s) => s.open)

  const [submitOpen, setSubmitOpen] =
    useState(false)

  const normalizedStatus =
    typeof status === 'string'
      ? Number(status)
      : status

  console.log(
    '[ORDER STATUS DEBUG]',
    {
      raw: status,
      normalized: normalizedStatus,
      type: typeof status,
    }
  )
  
  const canSubmitForReview =
    normalizedStatus === 1 ||
    normalizedStatus === 7 ||
    status === 'ВРаботе' ||
    status === 'НаДоработке'

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

        {canSubmitForReview && (
          <button
            type="button"
            className={`${button.btn} ${button.btnSuccess}`}
            onClick={() =>
              setSubmitOpen(true)
            }
          >
            Отправить на проверку
          </button>
        )}

        <button
          type="button"
          className={`${button.btn} ${button.btnDanger}`}
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
        </button>
      </div>
      <SubmitForReviewModal
        orderId={orderId}
        isOpen={submitOpen}
        onClose={() =>
          setSubmitOpen(false)
        }
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey:
              ordersKeys.byId(orderId),
          })
        }}
      />
    </section>
  )
}