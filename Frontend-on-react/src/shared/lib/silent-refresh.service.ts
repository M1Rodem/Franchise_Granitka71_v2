import { httpClient } from '@/shared/api/http-client'
import { useAuthStore } from '@/shared/store/auth.store'
import { jwtDecode } from 'jwt-decode'

interface JwtPayload {
  exp: number;
  [key: string]: any;
}

const REFRESH_BEFORE_MS = 50 * 1000 // Обновляем за 10 секунд до истечения
const CHECK_INTERVAL_MS = 20 * 1000 // Проверка каждые 20 секунд
const MIN_REFRESH_INTERVAL = 45 * 1000 // Минимум 45 секунд между refresh

let refreshPromise: Promise<void> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let checkInterval: ReturnType<typeof setInterval> | null = null
let lastRefreshTime = 0
let isRefreshing = false
let isServiceActive = false

export async function performRefresh(): Promise<void> {
  const now = Date.now()
  
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    console.log(`[Auth Refresh] Skipping - too soon (${Math.round((now - lastRefreshTime)/1000)}s)`)
    return
  }

  if (isRefreshing) {
    console.log('[Auth Refresh] Already refreshing, waiting...')
    if (refreshPromise) {
      return refreshPromise
    }
    return
  }

  isRefreshing = true
  
  refreshPromise = (async () => {
    try {
      console.log('[Auth Refresh] Performing refresh...')
      lastRefreshTime = now
      
      const store = useAuthStore.getState()
      const currentRefreshToken = store.refreshToken

      if (!currentRefreshToken) {
        throw new Error('No refresh token')
      }

      const res = await httpClient.post('/api/auth/refresh', {
        refreshToken: currentRefreshToken
      })
      
      const { token, refreshToken } = res.data
      const currentUser = store.user

      if (!currentUser) {
        throw new Error('No user in store')
      }

      const decoded = jwtDecode<JwtPayload>(token)
      const newExpiresAt = decoded.exp * 1000

      // Обновляем сессию НО без destroy сервиса
      store.updateSession({
        user: currentUser,
        token,
        refreshToken
      })

      console.log(`[Auth Refresh] Success, new token expires at: ${new Date(newExpiresAt).toLocaleTimeString()}`)

    } catch (error) {
      console.error('[Auth Refresh] Failed:', error)
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any
        if (axiosError.response?.status === 401) {
          useAuthStore.getState().clearSession()
        }
      }
      
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
  
  // Логируем реже
  if (Math.random() < 0.2) {
    console.log(`[Auth] Time left: ${Math.round(timeLeft/1000)}s, last refresh: ${Math.round(timeSinceLastRefresh/1000)}s ago`)
  }
  
  if (timeLeft < REFRESH_BEFORE_MS && timeSinceLastRefresh > MIN_REFRESH_INTERVAL) {
    console.log(`[Auth] Need refresh! Time left ${Math.round(timeLeft/1000)}s`)
    try {
      await performRefresh()
      return true
    } catch (error) {
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
  const timeUntilExpiry = expiresAt - now
  const timeout = Math.max(0, timeUntilExpiry - REFRESH_BEFORE_MS)

  console.log(`[Auth] Scheduling refresh in ${Math.round(timeout/1000)}s (expires in ${Math.round(timeUntilExpiry/1000)}s)`)

  if (timeout <= 1000) {
    refreshTimer = setTimeout(() => {
      checkAndRefreshIfNeeded().catch(console.error)
    }, 100)
  } else {
    refreshTimer = setTimeout(() => {
      checkAndRefreshIfNeeded().catch(console.error)
    }, timeout)
  }
}

export const silentRefreshService = {
  // Для первого запуска или после логаута
  start(expiresAt: number) {
    if (isServiceActive) {
      console.log('[Auth] Service already active, rescheduling...')
      scheduleRefresh(expiresAt)
      return
    }
    
    console.log('[Auth] Starting service...')
    isServiceActive = true
    
    scheduleRefresh(expiresAt)
    
    if (!checkInterval) {
      checkInterval = setInterval(() => {
        if (isServiceActive && !isRefreshing) {
          checkAndRefreshIfNeeded().catch(console.error)
        }
      }, CHECK_INTERVAL_MS)
    }

    console.log('[Auth] Silent refresh service started')
  },

  // Для обновления расписания без остановки сервиса
  updateSchedule(expiresAt: number) {
    if (!isServiceActive) {
      this.start(expiresAt)
      return
    }
    
    console.log('[Auth] Updating refresh schedule...')
    scheduleRefresh(expiresAt)
  },

  // Полная остановка (только при логауте)
  destroy() {
    console.log('[Auth] Destroying service...')
    
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
    
    console.log('[Auth] Silent refresh service destroyed')
  }
}