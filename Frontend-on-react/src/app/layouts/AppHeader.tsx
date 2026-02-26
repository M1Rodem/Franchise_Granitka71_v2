import { useLocation } from 'react-router-dom';
import { routeTitles } from '@/app/router/navigation.config';
import { resolveRouteTitle } from '@/shared/lib/navigation';
import { useNotificationBadgeStore } from '@/modules/notifications/store/notification-badge.store';
import { useUiStore } from '@/shared/store/ui.store';
import styles from '@/app/layouts/app-header.module.css';

export function AppHeader() {
  const location = useLocation();
  const unreadCount = useNotificationBadgeStore((state) => state.unreadCount);
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);

  const title = resolveRouteTitle(location.pathname, routeTitles, 'Granitka71');

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

      <h1 className={styles.title}>{title}</h1>

      <div className={styles.badgeContainer} aria-label="Notification badge">
        <span className={styles.badgeValue}>{unreadCount}</span>
      </div>
    </header>
  );
}