import { create } from 'zustand'
import {
  AUTH_SESSION_TTL_MS,
  authSessionStorage,
} from '@/shared/lib/auth-session-storage'
import type { AuthUser } from '@/shared/types/auth'
import { silentRefreshService } from '@/shared/lib/silent-refresh.service'

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
    const expiresAt = Date.now() + AUTH_SESSION_TTL_MS

    authSessionStorage.write({
      user,
      token,
      refreshToken,
      expiresAt,
    })

    silentRefreshService.start(expiresAt)

    set({
      user,
      token,
      refreshToken,
      isAuthenticated: true,
      isHydrated: true,
      sessionExpiresAt: expiresAt,
    })
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