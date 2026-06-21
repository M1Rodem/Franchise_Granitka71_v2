import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppHeader } from '@/app/layouts/AppHeader';
import { Sidebar } from '@/app/layouts/Sidebar';
import { useUiStore } from '@/shared/store/ui.store';
import styles from '@/app/layouts/app-layout.module.css';
import { ConfirmModal } from '@/shared/ui/modal/ConfirmModal';
import { useSWUpdate } from '@/modules/pwa/hooks/useSWUpdate';
import button from '@/shared/ui/button.module.css';
import { TilePrecacheProgress } from '@/modules/pwa/components/TilePrecacheProgress'

export function AppLayout() {
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);
  const location = useLocation();
  const { updateAvailable, updateApp } = useSWUpdate();
  
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
              style={{ height: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ConfirmModal />
      <TilePrecacheProgress />

      {/* Уведомление об обновлении */}
      {updateAvailable && (
        <div className={styles.swUpdateBanner}>
          <div className={styles.swUpdateContent}>
            <div className={styles.swUpdateIcon}>
              ⟳
            </div>

            <div className={styles.swUpdateText}>
              <div className={styles.swUpdateTitle}>
                Доступно обновление
              </div>

              <div className={styles.swUpdateDescription}>
                Загружена новая версия Granitka71 CRM
              </div>
            </div>
          </div>

          <button
            onClick={updateApp}
            className={`${button.btn} ${button.btnWarning}`}
          >
            Обновить
          </button>
        </div>
      )}
    </div>
  );
}