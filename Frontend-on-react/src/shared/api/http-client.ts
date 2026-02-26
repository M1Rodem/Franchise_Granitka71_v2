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

httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession();
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }

    return Promise.reject(error);
  },
);

export { UNAUTHORIZED_EVENT };