import { useNavigate } from 'react-router-dom'

import surface from '@/shared/ui/surface.module.css'
import button from '@/shared/ui/button.module.css'
import toolbar from '@/shared/ui/page-toolbar.module.css'
import { AppIcon } from '@/shared/ui/AppIcon'
import { useAuthStore } from '@/shared/store/auth.store'

import styles from './admin.page.module.css'

export default function AdminPage() {
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)

  return (
    <div className={styles.page}>
      <section className={surface.surface}>
        <div className={toolbar.shell}>
          <div className={toolbar.row}>
            <div className={toolbar.titleBlock}>
              <span className={toolbar.eyebrow}>Administration</span>
              <h1 className={toolbar.heading}>Центр управления CRM</h1>
              <p className={toolbar.description}>
                Управляйте сотрудниками и системными сущностями из единой
                административной панели.
              </p>
            </div>

            <div className={toolbar.meta}>
              <span className={toolbar.pill}>Безопасность ролей</span>
              <span className={toolbar.pill}>Строгая структура</span>
            </div>
          </div>
        </div>
      </section>

      <section className={surface.surface}>
        <div className={styles.adminWrapper}>
          <div className={styles.cardsGrid}>
            <button
              type="button"
              className={`${button.btn} ${button.btnGlass} ${styles.adminCard}`}
              onClick={() => navigate('/users')}
            >
              <div className={styles.cardTop}>
                <div className={styles.iconWrapper}>
                  <AppIcon name="admin" />
                </div>
                <span className={styles.cardPill}>Команда</span>
              </div>

              <div className={styles.cardTitle}>Пользователи</div>
              <div className={styles.cardDescription}>
                Управление учетными записями сотрудников. Создание, удаление и настройка ролей.
              </div>
            </button>

            {user?.role === 'SuperAdmin' && (
              <button
                type="button"
                className={`${button.btn} ${button.btnGlass} ${styles.adminCard}`}
                onClick={() => navigate('/admin/plots')}
              >
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>
                    <AppIcon name="archive" />
                  </div>
                  <span className={styles.cardPill}>Структура</span>
                </div>

                <div className={styles.cardTitle}>Участки</div>
                <div className={styles.cardDescription}>
                  Добавление, изменение и удаление участков в системе.
                </div>
              </button>
            )}
            {user?.role === 'SuperAdmin' && (
              <button
                type="button"
                className={`${button.btn} ${button.btnGlass} ${styles.adminCard}`}
                onClick={() => navigate('/admin/manager-finance')}
              >
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>
                    <AppIcon name="info" />
                  </div>

                  <span className={styles.cardPill}>
                    Аналитика
                  </span>
                </div>

                <div className={styles.cardTitle}>
                  Финансы менеджеров
                </div>

                <div className={styles.cardDescription}>
                  Анализ продаж, оплат и задолженности менеджеров за выбранный период.
                </div>
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
