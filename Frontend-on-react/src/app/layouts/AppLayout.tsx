import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppHeader } from '@/app/layouts/AppHeader';
import { Sidebar } from '@/app/layouts/Sidebar';
import { useUiStore } from '@/shared/store/ui.store';
import styles from '@/app/layouts/app-layout.module.css';

export function AppLayout() {
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);
  const location = useLocation();

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
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{
                duration: 0.25,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ height: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}