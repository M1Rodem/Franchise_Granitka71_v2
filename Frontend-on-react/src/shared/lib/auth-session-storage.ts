import { z } from 'zod';
import type { AuthUser } from '@/shared/types/auth';

const SESSION_KEY = 'granitka71.auth.session';

const authSessionSchema = z.object({
  token: z.string().min(1),
  user: z.object({
    id: z.number().int(),
    username: z.string(),
    fullName: z.string(),
    role: z.union([z.literal('Manager'), z.literal('Admin'), z.literal('SuperAdmin')]),
  }),
  expiresAt: z.number().int().positive(),
});

export interface PersistedAuthSession {
  token: string;
  user: AuthUser;
  expiresAt: number;
}

export const AUTH_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const authSessionStorage = {
  read(): PersistedAuthSession | null {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = authSessionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return parsed.data;
  },

  write(session: PersistedAuthSession): void {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  clear(): void {
    window.sessionStorage.removeItem(SESSION_KEY);
  },
};
