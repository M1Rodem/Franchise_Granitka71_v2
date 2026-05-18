import { useState } from 'react'

import { useMutation } from '@tanstack/react-query'

import { ordersApi } from '@/modules/orders/api/orders.api'

import { FormModal } from '@/shared/ui/modal/FormModal'

import { showTempMessage } from '@/shared/ui/temp-message.service'

import button from '@/shared/ui/button.module.css'

import { CompletionMediaUploader } from './CompletionMediaUploader'

import type {
  TempCompletionMedia,
} from './completion.types'

import styles from './completion.module.css'

interface Props {
  orderId: number

  isOpen: boolean

  onClose: () => void

  onSuccess: () => void
}

export function SubmitForReviewModal({
  orderId,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [note, setNote] =
    useState('')

  const [media, setMedia] =
    useState<TempCompletionMedia[]>(
      []
    )

  const submitMutation =
    useMutation({
      mutationFn: async () => {
        return ordersApi.submitForReview(
          orderId,
          {
            tempMediaIds:
              media.map(
                x => x.tempId
              ),

            note: note.trim(),
          }
        )
      },

      onSuccess: () => {
        showTempMessage(
          'success',
          'Запрос отправлен SuperAdmin'
        )

        setMedia([])
        setNote('')

        onSuccess()
        onClose()
      },

      onError: (error: any) => {
        const message =
          error?.response?.data?.message ||
          'Ошибка отправки'

        showTempMessage(
          'error',
          message
        )
      },
    })

  const footer = (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${button.btn} ${button.btnSecondary}`}
        onClick={onClose}
      >
        Отмена
      </button>

      <button
        type="button"
        className={`${button.btn} ${button.btnPrimary}`}
        disabled={
          submitMutation.isPending
        }
        onClick={() => {
          if (!note.trim()) {
            showTempMessage(
              'error',
              'Введите комментарий'
            )

            return
          }

          submitMutation.mutate()
        }}
      >
        {submitMutation.isPending
          ? 'Отправка...'
          : 'Отправить'}
      </button>
    </div>
  )

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Отправить на проверку"
      footer={footer}
      size="lg"
    >
      <div className={styles.section}>

        <CompletionMediaUploader
          items={media}
          onChange={setMedia}
        />

        <div>
          <div
            style={{
              marginBottom: 10,
              fontWeight: 600,
            }}
          >
            Примечание
          </div>

          <textarea
            value={note}
            onChange={(e) =>
              setNote(
                e.target.value
              )
            }
            className={styles.textarea}
            placeholder="Комментарий для SuperAdmin..."
          />
        </div>

      </div>
    </FormModal>
  )
}