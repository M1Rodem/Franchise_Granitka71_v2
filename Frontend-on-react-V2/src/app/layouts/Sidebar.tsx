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
import { useNotificationsStore } from '@/modules/notifications/store/notifications.store'
import { NotificationBadge } from '@/shared/ui/badge/NotificationBadge'
import button from '@/shared/ui/button.module.css'
import { motion } from 'framer-motion'

export function Sidebar() {
  const user = useAuthStore((state) => state.user)

  const visibleItems = filterNavigationByRole(navigationConfig, user?.role)

  const location = useLocation()
  const logout = useLogout()

  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed)
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen)

  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar)

  const color = useNotificationsStore((s) => s.selectSidebarColor())
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

        <motion.button
          type="button"
          className={styles.collapseBtn}
          aria-label="Toggle sidebar"
          onClick={handleToggle}
          whileTap={{ scale: 0.96 }}
        >
          <AppIcon
            name={isMobile ? 'close' : isSidebarCollapsed ? 'arrowRight' : 'arrowLeft'}
            className={styles.icon}
          />
        </motion.button>

      </div>

      {/* ================= NAVIGATION ================= */}

      <nav
        className={styles.nav}
        aria-label="Main navigation"
      >
        {visibleItems.map((item) => {

          const isActive = isNavigationItemActive(location.pathname, item)

          return (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <NavLink
                to={item.path}
                className={[
                  styles.navItem,
                  isActive ? styles.active : '',
                  item.id === 'notifications' && color === 'red'
                    ? styles.glow
                    : '',
                ].join(' ')}
                onClick={closeMobileSidebar}
              >
                <AppIcon
                  name={item.icon}
                  className={styles.icon}
                />

                {!isSidebarCollapsed && (
                  <span className={styles.navLabel}>
                    <span className={styles.navText}>{item.label}</span>

                    {item.id === 'notifications' && (
                      <span className={styles.badgeWrap}>
                        <NotificationBadge />
                      </span>
                    )}
                  </span>
                )}
              </NavLink>
            </motion.div>
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
          className={`${button.btn} ${button.btnDanger}`}
          onClick={() => void logout()}
        >
          {isSidebarCollapsed ? '✕' : 'Выход'}
        </button>

      </div>

    </aside>
  )
}
