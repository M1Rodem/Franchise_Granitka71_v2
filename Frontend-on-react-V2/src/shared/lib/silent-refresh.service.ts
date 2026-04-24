import { httpClient } from '@/shared/api/http-client'
import { useAuthStore } from '@/shared/store/auth.store'

const REFRESH_BEFORE_MS = 60 * 1000
const CHECK_INTERVAL_MS = 2 * 60 * 1000
const MIN_REFRESH_INTERVAL = 30 * 1000

let refreshPromise: Promise<void> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let checkInterval: ReturnType<typeof setInterval> | null = null
let lastRefreshTime = 0
let isRefreshing = false
let isServiceActive = false

export async function performRefresh(): Promise<void> {
  const now = Date.now()

  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    return
  }

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
        '/auth/refresh',
        {},
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const { token } = res.data
      const currentUser = store.user

      if (!currentUser) {
        throw new Error('No user in store')
      }

      store.updateSession({
        user: currentUser,
        token,
      })
    } catch (error) {
      let status: number | null = null

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } }
        status = axiosError.response?.status ?? null

        if (axiosError.response?.status === 401) {
          useAuthStore.getState().clearSession()
        }
      }

      console.error('[AUTH] Token refresh failed', { status })
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

  if (timeLeft < REFRESH_BEFORE_MS && timeSinceLastRefresh > MIN_REFRESH_INTERVAL) {
    try {
      await performRefresh()
      return true
    } catch {
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

  if (timeout <= 1000) {
    refreshTimer = setTimeout(() => {
      checkAndRefreshIfNeeded().catch(() => { })
    }, 100)
  } else {
    refreshTimer = setTimeout(() => {
      checkAndRefreshIfNeeded().catch(() => { })
    }, timeout)
  }
}

export const silentRefreshService = {
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
          checkAndRefreshIfNeeded().catch(() => { })
        }
      }, CHECK_INTERVAL_MS)
    }
  },

  updateSchedule(expiresAt: number) {
    if (!isServiceActive) {
      this.start(expiresAt)
      return
    }

    scheduleRefresh(expiresAt)
  },

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
  },
}
