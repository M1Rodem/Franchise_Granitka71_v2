import { create } from 'zustand'
import {
  AUTH_SESSION_TTL_MS,
  authSessionStorage,
} from '@/shared/lib/auth-session-storage'
import type { AuthUser } from '@/shared/types/auth'

interface AuthStoreState {
  user: AuthUser | null
  isAuthenticated: boolean
  isHydrated: boolean
  sessionExpiresAt: number | null

  setSession: (payload: { user: AuthUser; token: string }) => void
  hydrateSession: () => void
  clearSession: () => void
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  sessionExpiresAt: null,

  setSession: ({ user, token }) => {
    const expiresAt = Date.now() + AUTH_SESSION_TTL_MS

    authSessionStorage.write({
      user,
      token,
      expiresAt,
    })

    set({
      user,
      isAuthenticated: true,
      isHydrated: true,
      sessionExpiresAt: expiresAt,
    })
  },

  hydrateSession: () => {
    const session = authSessionStorage.read()

    if (!session || session.expiresAt <= Date.now()) {
      authSessionStorage.clear()

      set({
        user: null,
        isAuthenticated: false,
        isHydrated: true,
        sessionExpiresAt: null,
      })

      return
    }

    set({
      user: session.user,
      isAuthenticated: true,
      isHydrated: true,
      sessionExpiresAt: session.expiresAt,
    })
  },

  clearSession: () => {
    authSessionStorage.clear()

    set({
      user: null,
      isAuthenticated: false,
      isHydrated: true,
      sessionExpiresAt: null,
    })
  },
}))