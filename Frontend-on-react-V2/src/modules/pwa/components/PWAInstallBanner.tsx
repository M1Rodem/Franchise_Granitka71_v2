import { useState } from 'react'

import { usePWAInstall } from '../hooks/usePWAInstall'

import buttons from '@/shared/ui/button.module.css'

import styles from './pwa-install-banner.module.css'

export function PWAInstallBanner() {
  const { canInstall, install } = usePWAInstall()

  const [closed, setClosed] = useState(false)

  if (!canInstall || closed) {
    return null
  }

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <p className={styles.kicker}>
          PWA ПРИЛОЖЕНИЕ
        </p>

        <div>
          <h4 className={styles.title}>
            Установите Granitka71
          </h4>

          <p className={styles.description}>
            Работайте быстрее через приложение и
            используйте оффлайн режим.
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={install}
          className={`${buttons.btn} ${buttons.btnPrimary}`}
        >
          Установить
        </button>

        <button
          type="button"
          onClick={() => setClosed(true)}
          className={styles.closeButton}
        >
          ✕
        </button>
      </div>
    </div>
  )
}