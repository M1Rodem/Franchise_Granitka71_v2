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

httpClient.interceptors.request.use((config) => {
  const sessionRaw = localStorage.getItem('auth-session')

  if (sessionRaw) {
    const session = JSON.parse(sessionRaw)

    if (session.token) {
      config.headers = config.headers ?? {}
      config.headers.Authorization = `Bearer ${session.token}`
    }
  }

  return config
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
            .then((res) => {
              const { token, ...user } = res.data

              if (token) {
                useAuthStore.getState().setSession({
                  user,
                  token
                })
              }
            })
            .finally(() => {
              refreshPromise = null
            })
        }

        await refreshPromise

        if ((originalRequest as any)._retry) {
          return Promise.reject(error)
        }

        ;(originalRequest as any)._retry = true

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