import { httpClient } from '@/shared/api/http-client';
import type { LoginRequest, LoginResponse } from '@/shared/types/auth';

export const authApi = {
  login(payload: LoginRequest): Promise<LoginResponse> {
    return httpClient.post<LoginResponse>('/auth/login', payload).then((response) => response.data);
  },
  logout(): Promise<void> {
    return httpClient.post('/api/auth/logout').then(() => undefined);
  },
};
