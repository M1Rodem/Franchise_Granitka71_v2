import { NavLink, useLocation } from 'react-router-dom'
import { useLogout } from '@/modules/auth/hooks/use-logout'
import { navigationConfig } from '@/app/router/navigation.config'
import { useAuthStore } from '@/shared/store/auth.store'
import { useUiStore } from '@/shared/store/ui.store'
import { filterNavigationByRole, isNavigationItemActive } from '@/shared/lib/navigation'
import { AppIcon } from '@/shared/ui/AppIcon'
import styles from '@/app/layouts/sidebar.module.css'
import logo from '@/shared/assets/g71-logo.png'
import { useEffect, useState } from 'react'
import { useNotificationBadgeStore } from '@/modules/notifications/store/notification-badge.store'

export function Sidebar() {
  const user = useAuthStore((state) => state.user)

  const visibleItems = filterNavigationByRole(navigationConfig, user?.role)

  const location = useLocation()
  const logout = useLogout()

  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed)
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen)

  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar)
  const unreadCount =
    useNotificationBadgeStore((s) => s.unreadCount)

  const badgeType =
    useNotificationBadgeStore((s) => s.badgeType)

  /* ---------------------------------- */
  /* MOBILE DETECTION */
  /* ---------------------------------- */

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 960)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 960)
    }

    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  /* ---------------------------------- */
  /* COLLAPSE BUTTON HANDLER */
  /* ---------------------------------- */

  const handleToggle = () => {
    if (isMobile) {
      closeMobileSidebar()
    } else {
      toggleSidebar()
    }
  }

  return (
    <aside
      className={[
        styles.sidebar,
        isSidebarCollapsed ? styles.collapsed : '',
        isMobileSidebarOpen ? styles.mobileOpen : '',
      ].join(' ')}
    >

      {/* ================= HEADER ================= */}

      <div className={styles.header}>

        <div className={styles.branding}>
          <div className={styles.logo}>
            <img
              src={logo}
              alt="Granitka71 Logo"
              className={styles.logoImage}
            />

            {!isSidebarCollapsed && (
              <span className={styles.brand}>
                Granitka71
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className={styles.collapseBtn}
          aria-label="Toggle sidebar"
          onClick={handleToggle}
        >
          {isMobile ? '✕' : isSidebarCollapsed ? '>' : '<'}
        </button>

      </div>

      {/* ================= NAVIGATION ================= */}

      <nav
        className={styles.nav}
        aria-label="Main navigation"
      >
        {visibleItems.map((item) => {

          const isActive = isNavigationItemActive(location.pathname, item)

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={closeMobileSidebar}
            >
              <AppIcon
                name={item.icon}
                className={styles.icon}
              />

              {!isSidebarCollapsed && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%'
                  }}
                >

                  {item.label}

                  {item.id === 'notifications' && unreadCount > 0 && (
                    <span
                      className={[
                        styles.notificationBadge,
                        badgeType === 'impact' && styles.badgeImpact,
                        badgeType === 'snoozed' && styles.badgeSnoozed,
                        badgeType === 'system' && styles.badgeSystem,
                      ].filter(Boolean).join(' ')}
                    >
                      {unreadCount}
                    </span>
                  )}

                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* ================= FOOTER ================= */}

      <div className={styles.footer}>

        {!isSidebarCollapsed && user && (
          <p className={styles.userName}>
            {user.fullName}
          </p>
        )}

        <button
          type="button"
          className={styles.logoutButton}
          onClick={() => void logout()}
        >
          {isSidebarCollapsed ? '✕' : 'Выход'}
        </button>

      </div>

    </aside>
  )
}