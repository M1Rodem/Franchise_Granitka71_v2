import { useState, useEffect } from 'react'

import { tilePrecacheService } from '../services/tilePrecache.service'

import styles from './tile-precache-progress.module.css'

export function TilePrecacheProgress() {
  const [progress, setProgress] = useState({
    loaded: 0,
    total: 0,
    isActive: false,
  })

  const [show, setShow] = useState(false)

  useEffect(() => {
    if (tilePrecacheService.isPrecached()) {
      return
    }

    const timer = setTimeout(() => {
      setShow(true)

      tilePrecacheService.startPrecache(
        (loaded, total) => {
          setProgress({
            loaded,
            total,
            isActive: true,
          })
        },
        () => {
          setProgress({
            loaded: 0,
            total: 0,
            isActive: false,
          })

          setTimeout(() => {
            setShow(false)
          }, 3000)
        }
      )
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  if (!show) {
    return null
  }

  const percent =
    progress.total > 0
      ? Math.min(
          100,
          Math.round(
            (progress.loaded / progress.total) * 100
          )
        )
      : 0

  return (
    <div className={styles.banner}>
      <div className={styles.header}>
        <p className={styles.kicker}>
          Подготовка карты
        </p>

        <span className={styles.percent}>
          {percent}%
        </span>
      </div>

      <p className={styles.description}>
        Загружаем данные карты для работы без
        подключения к интернету.
      </p>

      <div className={styles.progress}>
        <div
          className={styles.progressFill}
          style={{
            width: `${percent}%`,
          }}
        />
      </div>

      <div className={styles.footer}>
        {progress.loaded} из {progress.total}
      </div>
    </div>
  )
}