import { useState } from 'react'
import { useNotificationActions } from '../hooks/useNotificationActions'
import { NotificationStatus } from '../types/notifications.types'
import buttonStyles from '@/shared/ui/button.module.css'
import { NotificationActionModal } from './NotificationActionModal'
import { isSystemNotification } from '../utils/notification-type'

interface Props {
  notificationId: number
  status: NotificationStatus
  canPostpone?: boolean
  type: number
  onDone?: () => void
}

export function NotificationActions({
  notificationId,
  status,
  canPostpone,
  type,
  onDone,
}: Props) {
  const [modalType, setModalType] = useState<'accept' | 'reject' | null>(null)

  const { accept, reject, snooze, isLoading } =
    useNotificationActions({ notificationId })

  const canAct =
    status === NotificationStatus.Pending ||
    status === NotificationStatus.Postponed

  const isSystem = isSystemNotification(type)

  if (!canAct) return null

  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {isSystem ? (
          <button
            className={`${buttonStyles.btn} ${buttonStyles.btnPrimary}`}
            onClick={() => {
              accept()
              onDone?.()
            }}
            disabled={isLoading}
          >
            Пометить как прочитанное
          </button>
        ) : (
          <>
            <button
              className={`${buttonStyles.btn} ${buttonStyles.btnSuccess}`}
              onClick={() => setModalType('accept')}
              disabled={isLoading}
            >
              Принять
            </button>

            <button
              className={`${buttonStyles.btn} ${buttonStyles.btnDanger}`}
              onClick={() => setModalType('reject')}
              disabled={isLoading}
            >
              Отклонить
            </button>

            {canPostpone && status === NotificationStatus.Pending && (
              <button
                className={`${buttonStyles.btn} ${buttonStyles.btnWarning}`}
                onClick={() => snooze(30)}
                disabled={isLoading}
              >
                Отложить (30 мин)
              </button>
            )}
          </>
        )}
      </div>

      <NotificationActionModal
        isOpen={modalType !== null}
        type={modalType ?? 'accept'}
        isLoading={isLoading}
        onClose={() => setModalType(null)}
        onConfirm={(note) => {
          if (modalType === 'accept') accept(note)
          if (modalType === 'reject') reject(note)

          setModalType(null)
          onDone?.()
        }}
      />
    </>
  )
}
