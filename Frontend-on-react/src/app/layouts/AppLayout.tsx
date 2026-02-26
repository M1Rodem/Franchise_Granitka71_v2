import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/app/layouts/AppHeader';
import { Sidebar } from '@/app/layouts/Sidebar';
import { useUiStore } from '@/shared/store/ui.store';
import styles from '@/app/layouts/app-layout.module.css';

export function AppLayout() {
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);

  return (
    <div className={styles.shell}>
      <Sidebar />

      {isMobileSidebarOpen && (
        <button
          type="button"
          className={styles.overlay}
          aria-label="Закрыть меню"
          onClick={closeMobileSidebar}
        />
      )}

      <div className={styles.contentArea}>
        <AppHeader />
        <main className={styles.mainContent}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}