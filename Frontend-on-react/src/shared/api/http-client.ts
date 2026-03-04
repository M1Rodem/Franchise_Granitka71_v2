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
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise: Promise<void> | null = null

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config

    if (!originalRequest) {
      return Promise.reject(error)
    }

    const isLoginRequest = originalRequest.url?.includes('/api/auth/login')
    const isRefreshRequest = originalRequest.url?.includes('/api/auth/refresh')

    if (
      error.response?.status === 401 &&
      !isLoginRequest &&
      !isRefreshRequest
    ) {
      try {
        if (!refreshPromise) {
          refreshPromise = httpClient
            .post('/api/auth/refresh')
            .then(() => {})
            .finally(() => {
              refreshPromise = null
            })
        }

        await refreshPromise

        return httpClient(originalRequest)
      } catch (refreshError) {
        useAuthStore.getState().clearSession()
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)

export { UNAUTHORIZED_EVENT }