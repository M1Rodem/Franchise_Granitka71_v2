import axios from 'axios'
import type { AxiosError } from 'axios'
import { env } from '@/shared/config/env'
import { useAuthStore } from '@/shared/store/auth.store'
import type { ApiErrorResponse } from '@/shared/types/api'
import { performRefresh } from '@/shared/lib/silent-refresh.service'

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
  const token = useAuthStore.getState().token

  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
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

      if (isRefreshRequest) {
        console.warn('[HTTP] Refresh token invalid → clearing session')

        useAuthStore.getState().clearSession()

        window.dispatchEvent(
          new CustomEvent(UNAUTHORIZED_EVENT)
        )

        return Promise.reject(error)
      }

      if (isLoginRequest) {
        return Promise.reject(error)
      }

      try {
        console.log('[HTTP] 401 → triggering refresh')

        await performRefresh()

        console.log('[HTTP] retrying original request')

        return httpClient(originalRequest)

      } catch (refreshError) {
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export { UNAUTHORIZED_EVENT }