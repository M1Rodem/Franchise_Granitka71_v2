import { useState, useEffect } from 'react'

declare global {
  interface WindowEventMap {
    'sw-update': CustomEvent<{ version: string }>
  }
}

export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    const handleUpdate = (event: CustomEvent<{ version: string }>) => {
      console.log('New version available:', event.detail.version)
      setUpdateAvailable(true)
    }

    window.addEventListener('sw-update', handleUpdate as EventListener)

    return () => {
      window.removeEventListener('sw-update', handleUpdate as EventListener)
    }
  }, [])

  const updateApp = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    } else {
      window.location.reload()
    }
  }

  return { updateAvailable, updateApp, setWaitingWorker }
}