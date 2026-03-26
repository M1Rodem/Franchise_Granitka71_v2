import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { env } from '@/shared/config/env'
import { useAuthStore } from '@/shared/store/auth.store'
import type { ApiErrorResponse } from '@/shared/types/api'
import { performRefresh } from '@/shared/lib/silent-refresh.service'

const UNAUTHORIZED_EVENT = 'auth:unauthorized'
const REFRESH_TIMEOUT = 10000

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: any) => void
  config: CustomAxiosRequestConfig
}> = []

const processQueue = (error: any = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error)
    } else {
      promise.resolve(httpClient(promise.config))
    }
  })

  failedQueue = []
}

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  _queueProcessed?: boolean
}

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  withCredentials: true,
})

httpClient.interceptors.request.use(async (config: CustomAxiosRequestConfig) => {
  const token = useAuthStore.getState().token

  if (token && !config.url?.includes('/api/auth/refresh')) {
    const { checkAndRefreshIfNeeded } = await import('@/shared/lib/silent-refresh.service')
    await checkAndRefreshIfNeeded()
  }

  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as CustomAxiosRequestConfig

    if (!originalRequest) {
      return Promise.reject(error)
    }

    if (originalRequest._queueProcessed) {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const isLoginRequest = originalRequest.url?.includes('/api/auth/login')
    const isRefreshRequest = originalRequest.url?.includes('/api/auth/refresh')

    if (status === 401 && !isLoginRequest && !isRefreshRequest) {
      if (originalRequest._retry) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve,
            reject,
            config: {
              ...originalRequest,
              _queueProcessed: true,
            },
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshPromise = performRefresh()
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Refresh timeout')), REFRESH_TIMEOUT)
        })

        await Promise.race([refreshPromise, timeoutPromise])

        const newToken = useAuthStore.getState().token
        if (!newToken) {
          throw new Error('No token after refresh')
        }

        originalRequest.headers.Authorization = `Bearer ${newToken}`
        processQueue(null)
        return httpClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        useAuthStore.getState().clearSession()
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export { UNAUTHORIZED_EVENT }
