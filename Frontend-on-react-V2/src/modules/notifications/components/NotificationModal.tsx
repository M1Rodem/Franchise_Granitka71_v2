import { useQuery } from '@tanstack/react-query';
import { NotificationActions } from './NotificationActions';
import { FormModal } from '@/shared/ui/modal/FormModal';
import { notificationsApi } from '../api/notifications.api';
import type { NotificationResponseDto } from '../types/notifications.types';
import { DiffAccordion } from './DiffAccordion';
import surfaceStyles from '@/shared/ui/surface.module.css';
import { formatNotificationDateTime } from '../utils/date';
import { getNotificationTypeLabel } from '../utils/notification-type';
import scrollStyles from '@/shared/ui/scroll.module.css';
import { useNavigate } from 'react-router-dom';
import buttonStyles from '@/shared/ui/button.module.css';
import { isSystemNotification as isSystem } from '../utils/notification-type';
import { useNotificationActions } from '../hooks/useNotificationActions';
import styles from './notification-modal.module.css';

interface Props {
  notification: NotificationResponseDto | null;
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationModal({ notification, isOpen, onClose }: Props) {
  const { accept } = useNotificationActions({
    notificationId: notification?.id ?? 0,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['notification-details', notification?.id],
    queryFn: () => notificationsApi.getNotificationDetails(notification!.id),
    enabled: isOpen && !!notification,
  });
  const message =
    data?.comment ||
    (data as any)?.message ||
    (data as any)?.text ||
    (data as any)?.description ||
    null;
  const navigate = useNavigate();
  const isSystemNotification = data?.type ? isSystem(data.type) : false;
  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Уведомление #${notification?.id ?? ''}`}
      size="xl"
      footer={
        notification && (
          <div className={styles.footerActions}>
            <button
              className={`${buttonStyles.btn} ${buttonStyles.btnPrimary}`}
              onClick={() => {
                if (!data?.order?.id) return;
                navigate(`/orders/${data.order.id}`);
                onClose();
              }}
            >
              Перейти в заказ
            </button>

            {isSystemNotification ? (
              <button
                className={`${buttonStyles.btn} ${buttonStyles.btnPrimary}`}
                onClick={() => {
                  if (!notification) return;
                  accept();
                  onClose();
                }}
              >
                Пометить как прочитанное
              </button>
            ) : (
              <NotificationActions
                notificationId={notification.id}
                status={notification.status}
                canPostpone={notification.canPostpone}
                type={notification.type}
                onDone={onClose}
              />
            )}

            <button className={`${buttonStyles.btn} ${buttonStyles.btnNeutral}`} onClick={onClose}>
              Закрыть
            </button>
          </div>
        )
      }
    >
      {isLoading && <div>Отклонение...</div>}

      {data && (
        <div className={`${scrollStyles.scroll} ${styles.scrollArea}`}>
          <div className={scrollStyles.scrollContent}>
            <div className={surfaceStyles.surface}>
              <h3 className={surfaceStyles.sectionTitle}>
                Информация об уведомлении
              </h3>

              <div className={surfaceStyles.infoGrid}>
                <div className={surfaceStyles.infoRow}>
                  <span className={surfaceStyles.infoLabel}>Тип уведомления</span>
                  <span className={surfaceStyles.infoValueStrong}>
                    {getNotificationTypeLabel(data.type)}
                  </span>
                </div>

                <div className={surfaceStyles.infoRow}>
                  <span className={surfaceStyles.infoLabel}>Дата создания</span>
                  <span className={surfaceStyles.infoValue}>
                    {formatNotificationDateTime(data.createdAt)}
                  </span>
                </div>

                <div className={surfaceStyles.infoRow}>
                  <span className={surfaceStyles.infoLabel}>Заказ</span>
                  <span className={surfaceStyles.infoValueStrong}>#{data.order.number}</span>
                </div>

                {!isSystemNotification && (
                  <div className={surfaceStyles.infoRow}>
                    <span className={surfaceStyles.infoLabel}>Инициатор</span>
                    <span className={surfaceStyles.infoValue}>{data.initiator.name}</span>
                  </div>
                )}

                {message && (
                  <div className={surfaceStyles.infoRow}>
                    <span className={surfaceStyles.infoLabel}>Сообщение</span>
                    <span className={`${surfaceStyles.infoValue} ${styles.messageValue}`}>
                      {message}
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
  );
}
