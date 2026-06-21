import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ordersApi } from '@/modules/orders/api/orders.api'
import { FormModal } from '@/shared/ui/modal/FormModal'
import { showTempMessage } from '@/shared/ui/temp-message.service'
import button from '@/shared/ui/button.module.css'
import input from '@/shared/ui/input.module.css'
import layout from '@/shared/ui/form-layout.module.css'
import { CompletionMediaUploader } from './CompletionMediaUploader'
import type { TempCompletionMedia } from './completion.types'

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
  const [note, setNote] = useState('')
  const [media, setMedia] = useState<TempCompletionMedia[]>([])

  const submitMutation = useMutation({
    mutationFn: async () => {
      return ordersApi.submitForReview(orderId, {
        tempMediaIds: media.map((x) => x.tempId),
        note: note.trim(),
      })
    },
    onSuccess: () => {
      showTempMessage('success', 'Запрос отправлен SuperAdmin')
      setMedia([])
      setNote('')
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Ошибка отправки'
      showTempMessage('error', message)
    },
  })

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
      <button
        type="button"
        className={`${button.btn} ${button.btnSecondary}`}
        onClick={onClose}
      >
        Отмена
      </button>
      <button
        type="button"
        className={`${button.btn} ${button.btnSuccess}`}
        disabled={submitMutation.isPending || !note.trim()}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? 'Отправка...' : 'Отправить'}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <CompletionMediaUploader items={media} onChange={setMedia} />

        <div className={layout.field}>
          <label className={layout.label}>Примечание</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={input.textarea}
            placeholder="Комментарий для SuperAdmin..."
            rows={4}
          />
        </div>
      </div>
    </FormModal>
  )
}