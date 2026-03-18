import { httpClient } from '@/shared/api/http-client'
import { useAuthStore } from '@/shared/store/auth.store'
import { notificationRealtimeService } from '@/modules/notifications/services/notification-realtime.service'
import { queryClient } from '@/app/providers/query-client'

const REFRESH_BEFORE_MS = 2 * 60 * 1000 // 2 минуты до истечения
const SAFE_MARGIN_MS = 30 * 1000 // 30 секунд запас
const CHECK_INTERVAL_MS = 60 * 1000 // Проверка каждую минуту

let refreshPromise: Promise<void> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let checkInterval: ReturnType<typeof setInterval> | null = null
let lastRefreshTime = 0

const MIN_REFRESH_INTERVAL = 5 * 60 * 1000 // Минимум 5 минут между refresh

export async function performRefresh(): Promise<void> {
  // Защита от слишком частых refresh
  const now = Date.now()
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    return
  }

  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      lastRefreshTime = now
      
      const store = useAuthStore.getState()
      const currentRefreshToken = store.refreshToken

      if (!currentRefreshToken) {
        throw new Error('No refresh token available in store')
      }
      const res = await httpClient.post('/api/auth/refresh', {
        refreshToken: currentRefreshToken
      })
      
      const { token, refreshToken } = res.data
      const currentUser = store.user

      if (!currentUser) {
        throw new Error('No user in store')
      }

      store.setSession({
        user: currentUser,
        token,
        refreshToken
      })

      await new Promise(resolve => setTimeout(resolve, 50))
      
      notificationRealtimeService.forceReconnect(queryClient).catch(err => {
        console.warn('[Auth Refresh] SignalR restart failed, but auth successful', err)
      })

    } catch (error) {
      console.error('[Auth Refresh] refresh failed', error)
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any
        if (axiosError.response?.status === 401) {
          useAuthStore.getState().clearSession()
        }
      }
      
      throw error
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function checkAndRefreshIfNeeded(): Promise<boolean> {
  const store = useAuthStore.getState()
  const expiresAt = store.sessionExpiresAt
  const token = store.token
  
  if (!expiresAt || !token) return false
  
  const now = Date.now()
  const timeLeft = expiresAt - now
  
  // Проверяем что прошло достаточно времени с последнего refresh
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    return false
  }
  
  // Если осталось меньше чем REFRESH_BEFORE_MS
  if (timeLeft < REFRESH_BEFORE_MS + SAFE_MARGIN_MS) {
    try {
      await performRefresh()
      return true
    } catch (error) {
      console.error('[Auth Refresh] Check refresh failed', error)
      return false
    }
  }
  
  return false
}

function scheduleRefresh(expiresAt: number) {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }

  const now = Date.now()
  const timeout = expiresAt - now - REFRESH_BEFORE_MS

  if (timeout <= 0) {
    refreshTimer = setTimeout(() => {
      checkAndRefreshIfNeeded().catch(() => {})
    }, 100)
  } else {
    refreshTimer = setTimeout(() => {
      checkAndRefreshIfNeeded().catch(() => {})
    }, timeout)
  }
}

export const silentRefreshService = {
  start(expiresAt: number) {    
    this.stop()
    
    scheduleRefresh(expiresAt)
    
    // Запускаем интервальную проверку
    checkInterval = setInterval(() => {
      checkAndRefreshIfNeeded().catch(() => {})
    }, CHECK_INTERVAL_MS)
  },

  stop() {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = null
    }
    refreshPromise = null
  }
}