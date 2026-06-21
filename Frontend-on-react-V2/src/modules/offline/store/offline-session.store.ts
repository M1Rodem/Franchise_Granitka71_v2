import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CachedEmployee } from '@/modules/offline/types/offline-employees.types'

interface OfflineSessionState {
  currentEmployee: CachedEmployee | null
  setCurrentEmployee: (employee: CachedEmployee | null) => void
  clearSession: () => void
}

export const useOfflineSessionStore = create<OfflineSessionState>()(
  persist(
    (set) => ({
      currentEmployee: null,
      setCurrentEmployee: (employee) => set({ currentEmployee: employee }),
      clearSession: () => set({ currentEmployee: null }),
    }),
    {
      name: 'offline-session-storage',
    }
  )
)