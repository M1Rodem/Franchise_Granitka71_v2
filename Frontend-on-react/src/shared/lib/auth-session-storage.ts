﻿import type { AuthUser } from '@/shared/types/auth';

const STORAGE_KEY = 'auth-session'

export interface PersistedAuthSession {
  user: AuthUser
  token: string
  refreshToken: string
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