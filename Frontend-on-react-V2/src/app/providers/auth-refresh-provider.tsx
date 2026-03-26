import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/shared/store/auth.store'
import { checkAndRefreshIfNeeded } from '@/shared/lib/silent-refresh.service'

export function AuthRefreshProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, sessionExpiresAt } = useAuthStore()
  const checkingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!isAuthenticated || !sessionExpiresAt) return

    const checkToken = async () => {
      if (checkingRef.current) return
      
      checkingRef.current = true
      try {
        await checkAndRefreshIfNeeded()
      } finally {
        checkingRef.current = false
      }
    }

    // Проверяем при монтировании с небольшой задержкой
    // чтобы не конфликтовать с инициализацией сервиса
    timeoutRef.current = setTimeout(checkToken, 1000)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Тоже с задержкой
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(checkToken, 500)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearTimeout(timeoutRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isAuthenticated, sessionExpiresAt])

  return <>{children}</>
}