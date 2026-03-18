import { create } from 'zustand'
import {
  authSessionStorage,
} from '@/shared/lib/auth-session-storage'
import type { AuthUser } from '@/shared/types/auth'
import { silentRefreshService } from '@/shared/lib/silent-refresh.service'
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  exp: number;
  [key: string]: any;
}

interface AuthStoreState {
  user: AuthUser | null
  token: string | null
  refreshToken: string | null

  isAuthenticated: boolean
  isHydrated: boolean
  sessionExpiresAt: number | null

  setSession: (payload: {
    user: AuthUser
    token: string
    refreshToken: string
  }) => void

  hydrateSession: () => void
  clearSession: () => void
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,

  isAuthenticated: false,
  isHydrated: false,
  sessionExpiresAt: null,

  setSession: ({ user, token, refreshToken }) => {
    // Декодируем токен и берем реальное время истечения
    const decoded = jwtDecode<JwtPayload>(token);
    const expiresAt = decoded.exp * 1000; // exp в секундах, переводим в миллисекунды

    authSessionStorage.write({
      user,
      token,
      refreshToken, 
      expiresAt, // используем реальное время из токена
    });

    silentRefreshService.start(expiresAt);

    set({
      user,
      token,
      refreshToken,
      isAuthenticated: true,
      isHydrated: true,
      sessionExpiresAt: expiresAt,
    });
  },

  hydrateSession: () => {
    const session = authSessionStorage.read()

    if (session && session.expiresAt > Date.now()) {
      silentRefreshService.start(session.expiresAt)

      set({
        user: session.user,
        token: session.token,
        refreshToken: session.refreshToken,
        isAuthenticated: true,
        isHydrated: true,
        sessionExpiresAt: session.expiresAt,
      })
      return
    }

    authSessionStorage.clear()

    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: true,
      sessionExpiresAt: null,
    })
  },

  clearSession: () => {
    authSessionStorage.clear()

    silentRefreshService.stop()

    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: true,
      sessionExpiresAt: null,
    })
  },
}))