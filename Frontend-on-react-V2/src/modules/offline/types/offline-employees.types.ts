export interface CachedEmployee {
  id: number
  username: string
  fullName: string
  lastSyncedAt: string
}

export interface SyncEmployeesResult {
  added: number
  updated: number
  total: number
}