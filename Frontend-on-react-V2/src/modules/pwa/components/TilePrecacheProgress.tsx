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
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    // Если уже закешировано — ничего не показываем
    if (tilePrecacheService.isPrecached()) {
      setIsComplete(true)
      return
    }

    // Проверяем, запущен ли процесс кеширования
    const currentProgress = tilePrecacheService.getProgress()
    
    if (currentProgress.isActive) {
      setShow(true)
      setProgress(currentProgress)
    } else {
      // Иначе ждем 5 секунд и запускаем
      const timer = setTimeout(() => {
        setShow(true)

        tilePrecacheService.precachePlots(
          undefined,
          (loaded, total) => {
            setProgress({
              loaded,
              total,
              isActive: true,
            })
          },
          () => {
            // Кеширование завершено
            setProgress({
              loaded: 0,
              total: 0,
              isActive: false,
            })
            setIsComplete(true)

            // Скрываем через 3 секунды
            setTimeout(() => {
              setShow(false)
            }, 3000)
          },
          (error) => {
            console.error('[TilePrecacheProgress] Ошибка:', error)
            setProgress({
              loaded: 0,
              total: 0,
              isActive: false,
            })
            
            setTimeout(() => {
              setShow(false)
            }, 5000)
          }
        )
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [])

  // ===== ВТОРОЙ ЭФФЕКТ: опрос прогресса и проверка завершения =====
  useEffect(() => {
    const interval = setInterval(() => {
      // Проверяем, не завершилось ли кеширование
      if (tilePrecacheService.isPrecached()) {
        setIsComplete(true)
        setTimeout(() => {
          setShow(false)
        }, 3000)
        return
      }

      const currentProgress = tilePrecacheService.getProgress()
      setProgress(currentProgress)
      
      if (currentProgress.isActive) {
        setShow(true)
      }
      
      // Если total > 0 и loaded === total, но isActive еще true
      // Значит кеширование завершилось, но onComplete еще не вызван
      if (
        currentProgress.total > 0 &&
        currentProgress.loaded === currentProgress.total &&
        !currentProgress.isActive
      ) {
        // Проверяем, действительно ли завершено
        if (tilePrecacheService.isPrecached()) {
          setIsComplete(true)
          setTimeout(() => {
            setShow(false)
          }, 3000)
        }
      }
    }, 500)
    
    return () => clearInterval(interval)
  }, [])

  // Не показываем если завершено
  if (!show || isComplete) {
    return null
  }

  // Если нет прогресса и не активно — не показываем
  if (!progress.isActive && progress.total === 0) {
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