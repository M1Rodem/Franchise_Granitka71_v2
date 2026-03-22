import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FormModal } from '@/shared/ui/modal/FormModal'
import { notificationsApi } from '../api/notifications.api'
import type { NotificationResponseDto } from '../types/notifications.types'
import { DiffAccordion } from './DiffAccordion'
import { NotificationStatus } from '../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'
import { formatNotificationDateTime } from '../utils/date'
import { getNotificationTypeLabel } from '../utils/notification-type'
import buttonStyles from '@/shared/ui/button.module.css'
import { useNavigate } from 'react-router-dom'
import scrollStyles from '@/shared/ui/scroll.module.css'

interface Props {
  notification: NotificationResponseDto | null
  isOpen: boolean
  onClose: () => void
}

export function NotificationModal({
  notification,
  isOpen,
  onClose,
}: Props) {
  const queryClient = useQueryClient()

  console.log('[Notifications DEBUG] modal open', notification?.id)

  const { data, isLoading } = useQuery({
    queryKey: ['notification-details', notification?.id],
    queryFn: () =>
      notificationsApi.getNotificationDetails(notification!.id),
    enabled: isOpen && !!notification,
  })

  const resolveMutation = useMutation({
    mutationFn: (status: 'Approved' | 'Rejected') =>
      notificationsApi.resolveNotification(notification!.id, { status }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notification-details'] })
      onClose()
    },
  })

  const postponeMutation = useMutation({
    mutationFn: () =>
      notificationsApi.postponeNotification(notification!.id, {
        minutes: 60,
      }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      onClose()
    },
  })
  const navigate = useNavigate()
  const canAct =
    notification?.status === NotificationStatus.Pending

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Уведомление #${notification?.id ?? ''}`}
      size="xl"
      footer={
        canAct && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            
            {/* ПЕРЕЙТИ В ЗАКАЗ */}
            <button
              className={buttonStyles.navigatorButton}
              onClick={() => {
                if (!data?.order?.id) return
                navigate(`/orders/${data.order.id}`)
                onClose()
              }}
            >
              Перейти в заказ
            </button>

            {/* ПОДТВЕРДИТЬ */}
            <button
              className={`${buttonStyles.btn} ${buttonStyles.btnSuccess}`}
              onClick={() => resolveMutation.mutate('Approved')}
              disabled={resolveMutation.isPending}
            >
              Подтвердить
            </button>

            {/* ОТКЛОНИТЬ */}
            <button
              className={`${buttonStyles.btn} ${buttonStyles.btnDanger}`}
              onClick={() => resolveMutation.mutate('Rejected')}
              disabled={resolveMutation.isPending}
            >
              Отклонить
            </button>

            {/* ОТЛОЖИТЬ */}
            {notification?.canPostpone && (
              <button
                className={`${buttonStyles.btn} ${buttonStyles.btnSecondary}`}
                onClick={() => postponeMutation.mutate()}
                disabled={postponeMutation.isPending}
              >
                Отложить
              </button>
            )}
          </div>
        )
      }
    >
      {isLoading && <div>Загрузка...</div>}

      {data && (
        <div className={scrollStyles.scroll} style={{ maxHeight: '70vh' }}>
          <div className={scrollStyles.scrollContent}>
            
            <div className={surfaceStyles.surface}>
              <h3 className={surfaceStyles.sectionTitle}>
                Информация об уведомлении
              </h3>

              <div className={surfaceStyles.infoGrid}>
                <div className={surfaceStyles.infoRow}>
                  <span className={surfaceStyles.infoLabel}>
                    Тип уведомления
                  </span>
                  <span className={surfaceStyles.infoValueStrong}>
                    {getNotificationTypeLabel(data.type)}
                  </span>
                </div>

                <div className={surfaceStyles.infoRow}>
                  <span className={surfaceStyles.infoLabel}>
                    Дата создания
                  </span>
                  <span className={surfaceStyles.infoValue}>
                    {formatNotificationDateTime(data.createdAt)}
                  </span>
                </div>

                <div className={surfaceStyles.infoRow}>
                  <span className={surfaceStyles.infoLabel}>
                    Заказ
                  </span>
                  <span className={surfaceStyles.infoValueStrong}>
                    #{data.order.number}
                  </span>
                </div>

                <div className={surfaceStyles.infoRow}>
                  <span className={surfaceStyles.infoLabel}>
                    Инициатор
                  </span>
                  <span className={surfaceStyles.infoValue}>
                    {data.initiator.name}
                  </span>
                </div>

                {data.comment && (
                  <div className={surfaceStyles.infoRow}>
                    <span className={surfaceStyles.infoLabel}>
                      Сообщение
                    </span>
                    <span
                      className={surfaceStyles.infoValue}
                      style={{ lineHeight: 1.4 }}
                    >
                      {data.comment}
                    </span>
                  </div>
                )}
              </div>
            </div>
        <DiffAccordion changes={data.changes} />
      </div>
      </div>
      )}
    </FormModal>
  )
}