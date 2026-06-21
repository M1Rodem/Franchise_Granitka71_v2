export interface CachedPlot {
  id: number
  name: string
  description: string | null
  latitude: number
  longitude: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastSyncedAt: string
}

export interface SyncPlotsResult {
  added: number
  updated: number
  total: number
}