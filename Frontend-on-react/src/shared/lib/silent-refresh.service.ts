import { httpClient } from '@/shared/api/http-client'
import { useAuthStore } from '@/shared/store/auth.store'

// для токена 15 минут (900000 мс)
const REFRESH_BEFORE_MS = 60 * 1000 // 1 минута до expiry
const CHECK_INTERVAL_MS = 2 * 60 * 1000 // Проверка каждые 2 минуты
const MIN_REFRESH_INTERVAL = 30 * 1000 // защита от спама

let refreshPromise: Promise<void> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let checkInterval: ReturnType<typeof setInterval> | null = null
let lastRefreshTime = 0
let isRefreshing = false
let isServiceActive = false

export async function performRefresh(): Promise<void> {
  console.log('[REFRESH] START', {
    now: Date.now(),
    lastRefreshTime
  })
  const now = Date.now()
  
  // Защита от слишком частых refresh
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    console.log('[REFRESH] SKIPPED (MIN_INTERVAL)', {
      now,
      lastRefreshTime
    })
    return
  }

  // Защита от параллельных refresh
  if (isRefreshing) {
    if (refreshPromise) {
      return refreshPromise
    }
    return
  }

  isRefreshing = true
  
  refreshPromise = (async () => {
    try {
      lastRefreshTime = now
      
      const store = useAuthStore.getState()

      const res = await httpClient.post(
        '/api/auth/refresh',
        {}, // 👈 обязательно пустой body
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
      console.log('[REFRESH] RESPONSE RECEIVED')
      
      const { token } = res.data
      const currentUser = store.user

      if (!currentUser) {
        throw new Error('No user in store')
      }

      // Обновляем сессию без destroy сервиса
      store.updateSession({
        
        user: currentUser,
        token,
      })
      console.log('[REFRESH] SUCCESS', {
        newTokenPreview: token.slice(0, 20)
      })
    } catch (error) {
      // Только критичные ошибки в консоль
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any
        if (axiosError.response?.status === 401) {
          useAuthStore.getState().clearSession()
        }
      }
      console.error('[REFRESH] FAILED', error)
      throw error
    } finally {
      refreshPromise = null
      isRefreshing = false
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
  const timeSinceLastRefresh = now - lastRefreshTime
  
  // Проверяем нужно ли обновление
  if (timeLeft < REFRESH_BEFORE_MS && timeSinceLastRefresh > MIN_REFRESH_INTERVAL) {
    try {
      console.log('[CHECK REFRESH] TRIGGER', {
        timeLeft,
        timeSinceLastRefresh
      })
      await performRefresh()
      return true
    } catch {
      return false
    }
  }
  console.log('[CHECK REFRESH]', {
    timeLeft,
    expiresAt,
    now
  })
  return false
}

function scheduleRefresh(expiresAt: number) {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }

  const now = Date.now()
  const timeUntilExpiry = expiresAt - now
  const timeout = Math.max(0, timeUntilExpiry - REFRESH_BEFORE_MS)

  console.log('[SCHEDULE]', {
    now,
    expiresAt,
    timeUntilExpiry,
    timeout
  })

  if (timeout <= 1000) {
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
  // Для первого запуска или после логаута
  start(expiresAt: number) {
    if (isServiceActive) {
      scheduleRefresh(expiresAt)
      return
    }
    
    isServiceActive = true
    scheduleRefresh(expiresAt)
    
    if (!checkInterval) {
      checkInterval = setInterval(() => {
        if (isServiceActive && !isRefreshing) {
          checkAndRefreshIfNeeded().catch(() => {})
        }
      }, CHECK_INTERVAL_MS)
    }
  },

  // Для обновления расписания без остановки сервиса
  updateSchedule(expiresAt: number) {
    if (!isServiceActive) {
      this.start(expiresAt)
      return
    }
    scheduleRefresh(expiresAt)
  },

  // Полная остановка (только при логауте)
  destroy() {    
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
    
    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = null
    }
    
    refreshPromise = null
    isRefreshing = false
    isServiceActive = false
    lastRefreshTime = 0
  }
}
