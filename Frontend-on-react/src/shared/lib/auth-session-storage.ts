import type { AuthUser } from '@/shared/types/auth';

const STORAGE_KEY = 'auth-session'

export const AUTH_SESSION_TTL_MS = 8 * 60 * 60 * 1000

export interface PersistedAuthSession {
  user: AuthUser
  expiresAt: number
}

export const authSessionStorage = {
  read(): PersistedAuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  },

  write(session: PersistedAuthSession) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY)
  },
}

export interface PersistedAuthSession {
  user: AuthUser
  expiresAt: number
}