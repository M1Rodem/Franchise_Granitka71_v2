import { httpClient } from '@/shared/api/http-client'
import { useAuthStore } from '@/shared/store/auth.store'
import { notificationRealtimeService } from '@/modules/notifications/services/notification-realtime.service'
import { queryClient } from '@/app/providers/query-client'

const REFRESH_BEFORE_MS = 2 * 60 * 1000

let refreshPromise: Promise<void> | null = null

let refreshTimer: ReturnType<typeof setTimeout> | null = null

export async function performRefresh(): Promise<void> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      console.log('[Auth Refresh] starting refresh')

      const res = await httpClient.post('/api/auth/refresh', {})

      const { token, refreshToken } = res.data

      const store = useAuthStore.getState()
      const currentUser = store.user

      if (!currentUser) return

      console.log('[Auth Refresh] new token received')

      store.setSession({
        user: currentUser,
        token,
        refreshToken
      })

      console.log('[Auth Refresh] restarting SignalR')

      await notificationRealtimeService.forceReconnect(queryClient)

      console.log('[Auth Refresh] SignalR restarted')

    } catch (error) {
      console.error('[Auth Refresh] refresh failed', error)
      useAuthStore.getState().clearSession()
      throw error
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

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

    console.log('[Auth Refresh] starting refresh')

    const res = await httpClient.post('/api/auth/refresh', {})

    const { token, refreshToken } = res.data

    const store = useAuthStore.getState()
    const currentUser = store.user

    if (!currentUser) return

    console.log('[Auth Refresh] new token received')

    store.setSession({
      user: currentUser,
      token,
      refreshToken
    })

    /*
    ==========================
    RESTART SIGNALR
    ==========================
    */

    console.log('[Auth Refresh] restarting SignalR')

    await notificationRealtimeService.disconnect()

    await notificationRealtimeService.connect(queryClient)

    console.log('[Auth Refresh] SignalR restarted')

  } catch (error) {

    console.error('[Auth Refresh] refresh failed', error)

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

  }

}