import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { env } from '@/shared/config/env'
import { useAuthStore } from '@/shared/store/auth.store'
import type { ApiErrorResponse } from '@/shared/types/api'
import { performRefresh } from '@/shared/lib/silent-refresh.service'

const UNAUTHORIZED_EVENT = 'auth:unauthorized'
const REFRESH_TIMEOUT = 10000 // 10 секунд таймаут для refresh

// Очередь запросов во время refresh
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: any) => void
  config: CustomAxiosRequestConfig
}> = []

const processQueue = (error: any = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(httpClient(prom.config))
    }
  })
  failedQueue = []
}

// Расширяем интерфейс для кастомных свойств
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  _queueProcessed?: boolean
}

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

httpClient.interceptors.request.use(async (config: CustomAxiosRequestConfig) => {
  const token = useAuthStore.getState().token

  // Не проверяем refresh запросы, чтобы избежать цикла
  if (token && !config.url?.includes('/api/auth/refresh')) {
    // Импортируем динамически, чтобы избежать циклической зависимости
    const { checkAndRefreshIfNeeded } = await import('@/shared/lib/silent-refresh.service')
    await checkAndRefreshIfNeeded()
  }

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
    const originalRequest = error.config as CustomAxiosRequestConfig

    if (!originalRequest) {
      return Promise.reject(error)
    }

    // Предотвращаем повторную обработку одного запроса
    if (originalRequest._queueProcessed) {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const isLoginRequest = originalRequest.url?.includes('/api/auth/login')
    const isRefreshRequest = originalRequest.url?.includes('/api/auth/refresh')

    if (status === 401 && !isLoginRequest && !isRefreshRequest) {
      if (originalRequest._retry) {
        // Уже пробовали обновить для этого запроса
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Ставим в очередь, а не пытаемся обновить снова
        return new Promise((resolve, reject) => {
          failedQueue.push({ 
            resolve, 
            reject, 
            config: {
              ...originalRequest,
              _queueProcessed: true
            }
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Добавляем таймаут для refresh
        const refreshPromise = performRefresh()
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Refresh timeout')), REFRESH_TIMEOUT)
        })

        await Promise.race([refreshPromise, timeoutPromise])

        // Обновляем токен в оригинальном запросе
        const newToken = useAuthStore.getState().token
        if (!newToken) {
          throw new Error('No token after refresh')
        }

        originalRequest.headers.Authorization = `Bearer ${newToken}`
        
        // Обрабатываем очередь
        processQueue(null)
        
        // Повторяем оригинальный запрос
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