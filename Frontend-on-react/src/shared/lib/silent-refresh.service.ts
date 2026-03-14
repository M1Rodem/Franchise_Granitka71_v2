import { httpClient } from '@/shared/api/http-client'
import { useAuthStore } from '@/shared/store/auth.store'

const REFRESH_BEFORE_MS = 2 * 60 * 1000

let refreshTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRefresh(expiresAt: number) {
  const now = Date.now()

  const timeout = expiresAt - now - REFRESH_BEFORE_MS

  if (timeout <= 0) {
    runRefresh()
    return
  }

  refreshTimer = setTimeout(runRefresh, timeout)
}

async function runRefresh() {
  try {
    const res = await httpClient.post('/api/auth/refresh', {})

    // Предполагаем, что сервер возвращает и token, и refreshToken
    const { token, refreshToken } = res.data

    const store = useAuthStore.getState()
    const currentUser = store.user

    if (!currentUser) return

    // Передаём все три обязательных поля
    store.setSession({
      user: currentUser,
      token,
      refreshToken, 
    })
  } catch {
    useAuthStore.getState().clearSession()
  }
}

export const silentRefreshService = {
  start(expiresAt: number) {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
    }

    scheduleRefresh(expiresAt)
  },

  stop() {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  },
}