import { useNavigate, useLocation } from 'react-router-dom';
import { routeTitles } from '@/app/router/navigation.config';
import { resolveRouteTitle } from '@/shared/lib/navigation';
import { useNotificationBadgeStore } from '@/modules/notifications/store/notification-badge.store';
import { useUiStore } from '@/shared/store/ui.store';
import styles from '@/app/layouts/app-header.module.css';

export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const unreadCount = useNotificationBadgeStore((state) => state.unreadCount);
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);
  const header = useUiStore((state) => state.header);

  const defaultTitle = resolveRouteTitle(
    location.pathname,
    routeTitles,
    'Granitka71'
  );

  const isOrderDetails = header.mode === 'orderDetails';
  const isAdminDetails = header.mode === 'adminDetails';

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label="Open menu"
        onClick={openMobileSidebar}
      >
        <span />
        <span />
        <span />
      </button>

      {/* Обычный заголовок */}
      {!isOrderDetails && !isAdminDetails && (
        <h1 className={styles.title}>{defaultTitle}</h1>
      )}

      {/* Режим заказа */}
      {isOrderDetails && (
        <>
          <h1 className={styles.detailsTitle}>
            {header.title} №{header.orderNumber}
          </h1>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className={styles.detailsBackButton}
          >
            ← Назад
          </button>

          <div className={styles.detailsActions}>
            <button
              type="button"
              className={styles.glassButton}
              disabled
            >
              Печать
            </button>

            <button
              type="button"
              className={styles.glassButton}
              disabled
            >
              Excel
            </button>
          </div>
        </>
      )}

      {/* Admin режим (Users / Plots) */}
      {isAdminDetails && (
        <div className={styles.detailsContainer}>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className={styles.detailsBackButton}
          >
            ← Назад
          </button>

          <h1 className={styles.detailsTitle}>
            {defaultTitle}
          </h1>
        </div>
      )}

      <div className={styles.badgeContainer} aria-label="Notification badge">
        <span className={styles.badgeValue}>{unreadCount}</span>
      </div>
    </header>
  );
}