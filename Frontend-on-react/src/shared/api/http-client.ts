import axios from 'axios';
import type { AxiosError } from 'axios';
import { env } from '@/shared/config/env';
import { tokenStorage } from '@/shared/api/token-storage';
import { useAuthStore } from '@/shared/store/auth.store';
import type { ApiErrorResponse } from '@/shared/types/api';

const UNAUTHORIZED_EVENT = 'auth:unauthorized';

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  withCredentials: true, // ВАЖНО
  headers: {
    'Content-Type': 'application/json',
  },
});

httpClient.interceptors.request.use((config) => {
  const token = tokenStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshPromise: Promise<string> | null = null;

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isLoginRequest = originalRequest.url?.includes('/api/auth/login');
    const isRefreshRequest = originalRequest.url?.includes('/api/auth/refresh');

    if (
      error.response?.status === 401 &&
      !isLoginRequest &&
      !isRefreshRequest
    ) {
      try {
        // чтобы не было нескольких параллельных refresh
        if (!refreshPromise) {
          refreshPromise = httpClient
          .post<{ token: string }>('/api/auth/refresh')
          .then((res) => {
            const newToken = res.data.token;
            tokenStorage.setToken(newToken);
            return newToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
        }

        const newToken = await refreshPromise;

        // подставляем новый токен
        if (originalRequest.headers) {
          originalRequest.headers.set(
            'Authorization',
            `Bearer ${newToken}`,
          );
        }

        return httpClient(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().clearSession();
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export { UNAUTHORIZED_EVENT };