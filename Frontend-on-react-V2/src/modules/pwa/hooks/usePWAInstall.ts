import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handler as EventListener)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener)
    }
  }, [])

  const install = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice

    if (result.outcome === 'accepted') {
      
    } else {

    }

    setDeferredPrompt(null)
    setCanInstall(false)
  }

  return { canInstall, install }
}