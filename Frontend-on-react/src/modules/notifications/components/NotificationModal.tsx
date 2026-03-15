import { FormModal } from '@/shared/ui/modal/FormModal'
import { NotificationInfo } from './NotificationInfo'
import { NotificationDiffBlock } from './NotificationDiffBlock'
import { showTempMessage } from '@/shared/ui/temp-message.service'
import button from '@/shared/ui/button.module.css'
import type { NotificationItem } from '../types/notification.types'

interface Props {
  notification: NotificationItem | null
  isOpen: boolean
  onClose: () => void
}

export function NotificationModal({
  notification,
  isOpen,
  onClose
}: Props) {

  if (!notification) return null

  const changes = notification.data?.proposedChanges

  const footer = (

    <>
      <button
        className={`${button.btn} ${button.btnSuccess}`}
        onClick={() => {
          showTempMessage('success', 'Принято')
        }}
      >
        Принять
      </button>

      <button
        className={`${button.btn} ${button.btnDanger}`}
        onClick={() => {
          showTempMessage('error', 'Отклонено')
        }}
      >
        Отклонить
      </button>

      {notification.canPostpone && (
        <button
          className={`${button.btn} ${button.btnSecondary}`}
        >
          Отложить
        </button>
      )}

      <button
        className={`${button.btn} ${button.btnSecondary}`}
        onClick={onClose}
      >
        Закрыть
      </button>
    </>

  )

  return (

    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={notification.title}
      size="lg"
      footer={footer}
    >

      <p>{notification.message}</p>

      <NotificationInfo notification={notification} />

      {notification.data?.comment && (
        <p>
          <b>Комментарий:</b> {notification.data.comment}
        </p>
      )}

      {changes && (
        <NotificationDiffBlock changes={changes} />
      )}

    </FormModal>

  )
}