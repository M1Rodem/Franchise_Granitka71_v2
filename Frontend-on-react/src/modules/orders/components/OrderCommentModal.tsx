import { useState } from 'react'
import { FormModal } from '@/shared/ui/modal/FormModal'
import buttonStyles from '@/shared/ui/button.module.css'
import inputStyles from '@/shared/ui/input.module.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (comment?: string) => void
  isLoading?: boolean
}

export function OrderCommentModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: Props) {
  const [comment, setComment] = useState('')

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Комментарий к изменению заказа"
      footer={
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`${buttonStyles.btn} ${buttonStyles.btnSuccess}`}
            onClick={() => { onConfirm(comment || undefined) }}
            disabled={isLoading}
          >
            Отправить
          </button>

          <button
            className={`${buttonStyles.btn} ${buttonStyles.btnSecondary}`}
            onClick={onClose}
          >
            Отмена
          </button>
        </div>
      }
    >
      <div className={inputStyles.field}>
        <label className={inputStyles.label}>
          Комментарий
        </label>

        <textarea
          className={inputStyles.textarea}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Опишите изменения..."
          maxLength={500}
          rows={4}
        />

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {comment.length} / 500
        </div>
      </div>
    </FormModal>
  )
}