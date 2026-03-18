import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/shared/store/auth.store'
import { checkAndRefreshIfNeeded } from '@/shared/lib/silent-refresh.service'

export function AuthRefreshProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, sessionExpiresAt } = useAuthStore()
  const checkingRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !sessionExpiresAt) return

    const checkToken = async () => {
      // Предотвращаем одновременные проверки
      if (checkingRef.current) return
      
      checkingRef.current = true
      try {
        await checkAndRefreshIfNeeded()
      } finally {
        checkingRef.current = false
      }
    }

    // Проверяем при монтировании
    checkToken()

    // Проверяем при возвращении на вкладку
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkToken()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isAuthenticated, sessionExpiresAt])

  return <>{children}</>
}