import { useState, useEffect } from 'react'
import { Workbox } from 'workbox-window'
import { connectivityService } from '@/modules/offline/services/connectivity.service'

export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setIsChecking(false)
      return
    }

    const wb = new Workbox('/sw.js')

    // Обнаружено обновление
    wb.addEventListener('waiting', (event) => {
      console.log('[SW Update] New version waiting')
      const sw = event.sw || null
      setWaitingWorker(sw)
      setUpdateAvailable(true)
    })

    // Обновление уже установлено
    wb.addEventListener('controlling', () => {
      console.log('[SW Update] SW is now controlling the page')
      window.location.reload()
    })

    // Проверка обновлений каждые 60 секунд (только если есть интернет)
    const intervalId = setInterval(() => {
      const isOnline = connectivityService.isOnline()
      if (isOnline && wb) {
        console.log('[SW Update] Checking for updates...')
        wb.update()
      } else if (!isOnline) {
        console.log('[SW Update] Offline, skipping update check')
      }
    }, 60000)

    // Регистрируем SW
    wb.register()
      .then(() => {
        console.log('[SW Update] Workbox registered')
        setIsChecking(false)
      })
      .catch((error) => {
        console.error('[SW Update] Registration failed:', error)
        setIsChecking(false)
      })

    return () => {
      clearInterval(intervalId)
      wb.removeEventListener('waiting', () => {})
      wb.removeEventListener('controlling', () => {})
    }
  }, [])

  const updateApp = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      setUpdateAvailable(false)
      setWaitingWorker(null)
    } else {
      window.location.reload()
    }
  }

  return { updateAvailable, updateApp, isChecking }
}