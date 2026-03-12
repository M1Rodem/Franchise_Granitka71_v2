import { useNavigate } from 'react-router-dom'

import surface from '@/shared/ui/surface.module.css'
import button from '@/shared/ui/button.module.css'
import { AppIcon } from '@/shared/ui/AppIcon'
import { useAuthStore } from '@/shared/store/auth.store'

import styles from './admin.page.module.css'

export default function AdminPage() {
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)

  return (
    <section className={surface.surface}>
      <div className={styles.adminWrapper}>
        <div className={styles.cardsGrid}>
          <button
            type="button"
            className={`${button.btn} ${button.btnPrimary} ${styles.adminCard}`}
            onClick={() => navigate('/users')}
          >
            <div className={styles.iconWrapper}>
              <AppIcon name="admin"/>
            </div>

            <div className={styles.cardTitle}>Пользователи</div>
            <div className={styles.cardDescription}>
              Управление учетными записями сотрудников. Создание, удаление и настройка ролей.
            </div>
          </button>

          {user?.role === 'SuperAdmin' && (
            <button
              type="button"
              className={`${button.btn} ${button.btnPrimary} ${styles.adminCard}`}
              onClick={() => navigate('/admin/plots')}
            >
              <div className={styles.iconWrapper}>
                <AppIcon name="archive"/>
              </div>

              <div className={styles.cardTitle}>Участки</div>
              <div className={styles.cardDescription}>
                Добавление, изменение и удаление участков в системе.
              </div>
            </button>
          )}
        </div>
      </div>
    </section>
  )
}