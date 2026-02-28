import { NavLink, useLocation } from 'react-router-dom';
import { useLogout } from '@/modules/auth/hooks/use-logout';
import { navigationConfig } from '@/app/router/navigation.config';
import { useAuthStore } from '@/shared/store/auth.store';
import { useUiStore } from '@/shared/store/ui.store';
import { filterNavigationByRole, isNavigationItemActive } from '@/shared/lib/navigation';
import { AppIcon } from '@/shared/ui/AppIcon';
import styles from '@/app/layouts/sidebar.module.css';
import logo from "@/shared/assets/g71-logo.png";

export function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const visibleItems = filterNavigationByRole(navigationConfig, user?.role);
  const location = useLocation();
  const logout = useLogout();

  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);

  return (
    <aside
      className={[
        styles.sidebar,
        isSidebarCollapsed ? styles.collapsed : '',
        isMobileSidebarOpen ? styles.mobileOpen : '',
      ].join(' ')}
    >
      <div className={styles.header}>
        <div className={styles.branding}>
          <div className={styles.logo}>
            <img src={logo} alt="Granitka71 Logo" className={styles.logoImage} />
            <span className={styles.brand}>Granitka71</span>
          </div>
        </div>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          {isSidebarCollapsed ? '>' : '<'}
        </button>
      </div>

      <nav className={styles.nav} aria-label="Main navigation">
        {visibleItems.map((item) => {
          const isActive = isNavigationItemActive(location.pathname, item);

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={closeMobileSidebar}
            >
              <AppIcon name={item.icon} className={styles.icon} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className={styles.footer}>
        {!isSidebarCollapsed && user && <p className={styles.userName}>{user.fullName}</p>}
        <button
          type="button"
          className={styles.logoutButton}
          onClick={() => {
            void logout();
          }}
        >
          {!isSidebarCollapsed ? 'Выход' : 'x'}
        </button>
      </div>
    </aside>
  );
}
