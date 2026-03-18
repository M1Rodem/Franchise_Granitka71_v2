import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { env } from '@/shared/config/env'
import { useAuthStore } from '@/shared/store/auth.store'
import type { ApiErrorResponse } from '@/shared/types/api'
import { performRefresh } from '@/shared/lib/silent-refresh.service'
import { checkAndRefreshIfNeeded } from '@/shared/lib/silent-refresh.service'

const UNAUTHORIZED_EVENT = 'auth:unauthorized'
const MAX_RETRY_ATTEMPTS = 2

// Расширяем интерфейс для кастомных свойств
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  _retryCount?: number
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

httpClient.interceptors.request.use((config: CustomAxiosRequestConfig) => {
  const token = useAuthStore.getState().token

  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

httpClient.interceptors.request.use(async (config: CustomAxiosRequestConfig) => {
  const token = useAuthStore.getState().token
  
  // Проверяем нужно ли обновить токен перед запросом (кроме запросов на refresh)
  if (token && !config.url?.includes('/api/auth/refresh')) {
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

    const status = error.response?.status
    const isLoginRequest = originalRequest.url?.includes('/api/auth/login')
    const isRefreshRequest = originalRequest.url?.includes('/api/auth/refresh')

    /*
    =============================
    HANDLE 401
    =============================
    */

    if (status === 401) {
      // Если это запрос на обновление токена и он не удался
      if (isRefreshRequest) {
        console.warn('[HTTP] Refresh token invalid → clearing session')
        useAuthStore.getState().clearSession()
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
        return Promise.reject(error)
      }

      // Если это запрос на логин
      if (isLoginRequest) {
        return Promise.reject(error)
      }

      // Проверяем, не пытались ли уже обновить токен для этого запроса
      if (originalRequest._retry) {
        console.warn('[HTTP] Already tried refresh for this request, giving up')
        return Promise.reject(error)
      }

      // Проверяем количество попыток
      const retryCount = originalRequest._retryCount || 0
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        console.warn(`[HTTP] Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached`)
        return Promise.reject(error)
      }

      try {
        // Помечаем, что пробуем обновить токен
        originalRequest._retry = true
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1

        // Ждем немного перед рефрешем (особенно важно при множественных запросах)
        if (retryCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount))
        }

        // Обновляем токен
        await performRefresh()

        // Получаем новый токен из store
        const newToken = useAuthStore.getState().token
        if (!newToken) {
          throw new Error('No token after refresh')
        }

        // Обновляем заголовок с новым токеном
        originalRequest.headers.Authorization = `Bearer ${newToken}`

        // Повторяем оригинальный запрос
        return httpClient(originalRequest)

      } catch (refreshError) {
        console.error('[HTTP] refresh failed:', refreshError)
        
        // Если все попытки исчерпаны, очищаем сессию
        if (retryCount >= MAX_RETRY_ATTEMPTS - 1) {
          useAuthStore.getState().clearSession()
          window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
        }
        
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
  
)


export { UNAUTHORIZED_EVENT }