import axios from 'axios'
import type { AxiosError } from 'axios'
import { env } from '@/shared/config/env'
import { useAuthStore } from '@/shared/store/auth.store'
import type { ApiErrorResponse } from '@/shared/types/api'

const UNAUTHORIZED_EVENT = 'auth:unauthorized'

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  withCredentials: true,
})

/*
=============================
REQUEST INTERCEPTOR
=============================
*/

httpClient.interceptors.request.use((config) => {
  const sessionRaw = localStorage.getItem('auth-session')

  if (sessionRaw) {
    try {
      const session = JSON.parse(sessionRaw)

      if (session?.token) {
        config.headers = config.headers ?? {}
        config.headers.Authorization = `Bearer ${session.token}`
      }
    } catch {
      localStorage.removeItem('auth-session')
    }
  }

  return config
})

/*
=============================
RESPONSE INTERCEPTOR
=============================
*/

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config

    if (!originalRequest) {
      return Promise.reject(error)
    }

    const status = error.response?.status

    const isLoginRequest =
      originalRequest.url?.includes('/api/auth/login')

    const isRefreshRequest =
      originalRequest.url?.includes('/api/auth/refresh')

    /*
    =============================
    HANDLE 401
    =============================
    */

    if (status === 401) {

      /*
      Если refresh тоже дал 401 — значит refresh token
      невалидный → нужно logout
      */

      if (isRefreshRequest) {

        console.warn('[HTTP] Refresh token invalid → clearing session')

        useAuthStore.getState().clearSession()

        window.dispatchEvent(
          new CustomEvent(UNAUTHORIZED_EVENT)
        )

        return Promise.reject(error)
      }

      /*
      Если это login — просто вернуть ошибку
      */

      if (isLoginRequest) {
        return Promise.reject(error)
      }

      /*
      Любой другой 401 НЕ вызывает logout
      Это может быть:
      - expired JWT
      - SignalR reconnect
      - гонка refresh
      */

      console.warn('[HTTP] 401 received, waiting for refresh')

      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
)

export { UNAUTHORIZED_EVENT }