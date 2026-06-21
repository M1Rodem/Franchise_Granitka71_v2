import { create } from 'zustand'
import { authSessionStorage } from '@/shared/lib/auth-session-storage'
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

  isAuthenticated: boolean
  isHydrated: boolean
  sessionExpiresAt: number | null

  setSession: (payload: {
    user: AuthUser
    token: string
  }) => void
  
  updateSession: (payload: {
    user: AuthUser
    token: string
  }) => void

  hydrateSession: () => void
  clearSession: () => void

  setOfflineSession: (user: AuthUser) => void
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  token: null,

  isAuthenticated: false,
  isHydrated: false,
  sessionExpiresAt: null,

  setSession: ({ user, token }) => {
    const decoded = jwtDecode<JwtPayload>(token);
    const expiresAt = decoded.exp * 1000;

    authSessionStorage.write({
      user,
      token,
      expiresAt,
    });

    silentRefreshService.destroy()
    silentRefreshService.start(expiresAt);

    set({
      user,
      token,
      isAuthenticated: true,
      isHydrated: true,
      sessionExpiresAt: expiresAt,
    });
  },

  // ДОБАВЛЕНО: для обновления после refresh без destroy
  updateSession: ({ user, token }) => {
    const decoded = jwtDecode<JwtPayload>(token);
    const expiresAt = decoded.exp * 1000;

    authSessionStorage.write({
      user,
      token,
      expiresAt,
    });

    silentRefreshService.updateSchedule(expiresAt);

    set({
      user,
      token,
      isAuthenticated: true,
      sessionExpiresAt: expiresAt,
    });
  },

  hydrateSession: () => {
    const session = authSessionStorage.read()

    if (session && session.expiresAt > Date.now()) {
      silentRefreshService.destroy()
      silentRefreshService.start(session.expiresAt)

      set({
        user: session.user,
        token: session.token,
        isAuthenticated: true,
        isHydrated: true,
        sessionExpiresAt: session.expiresAt,
      })
      return
    }

    authSessionStorage.clear()
    silentRefreshService.destroy()

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: true,
      sessionExpiresAt: null,
    })
  },

  clearSession: () => {
    authSessionStorage.clear()
    silentRefreshService.destroy()

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: true,
      sessionExpiresAt: null,
    })
  },
  setOfflineSession: (user: AuthUser) => {
    set({
      user,
      isAuthenticated: true,
      isHydrated: true,
    })
  },
}))