import { useState } from 'react'
import { FormModal } from '@/shared/ui/modal/FormModal'
import buttonStyles from '@/shared/ui/button.module.css'
import inputStyles from '@/shared/ui/input.module.css'

interface Props {
  isOpen: boolean
  type: 'accept' | 'reject'
  onClose: () => void
  onConfirm: (note?: string) => void
  isLoading?: boolean
}

export function NotificationActionModal({
  isOpen,
  type,
  onClose,
  onConfirm,
  isLoading,
}: Props) {
  const [note, setNote] = useState('')

  const isAccept = type === 'accept'

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isAccept ? 'Принять уведомление' : 'Отклонить уведомление'}
      footer={
        <div style={{ display: 'flex', gap: 10 }}>

          <button
            className={`${buttonStyles.btn} ${
              isAccept ? buttonStyles.btnSuccess : buttonStyles.btnDanger
            }`}
            onClick={() => onConfirm(note || undefined)}
            disabled={isLoading}
          >
            {isAccept ? 'Подтвердить' : 'Отклонить'}
          </button>

          <button
            className={`${buttonStyles.btn} ${buttonStyles.btnNeutral}`}
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
          placeholder="Введите комментарий...(Можно оставить пустым)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
        />
      </div>
    </FormModal>
  )
}