import { usersApi } from '@/modules/users/api/users.api'
import { offlineEmployeesStore } from '@/modules/offline/storage/offline-employees.store'
import type { CachedEmployee, SyncEmployeesResult } from '@/modules/offline/types/offline-employees.types'
import type { OfflineEmployeeDto } from '@/modules/users/types/users.types'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const offlineEmployeesService = {
  async syncEmployees(retryCount: number = 0): Promise<SyncEmployeesResult> {
    try {      
      const employees: OfflineEmployeeDto[] = await usersApi.getEmployeesForOffline()

      const cachedEmployees: CachedEmployee[] = employees.map((employee: OfflineEmployeeDto) => ({
        id: employee.id,
        username: employee.username,
        fullName: employee.fullName,
        lastSyncedAt: new Date().toISOString(),
      }))

      const existingEmployees = await offlineEmployeesStore.getAllEmployees()
      const existingMap = new Map(existingEmployees.map((e: CachedEmployee) => [e.id, e]))

      let added = 0
      let updated = 0

      for (const newEmp of cachedEmployees) {
        const existing = existingMap.get(newEmp.id)

        if (!existing) {
          added++
        } else if (
          existing.username !== newEmp.username ||
          existing.fullName !== newEmp.fullName
        ) {
          updated++
        }
      }

      await offlineEmployeesStore.saveEmployees(cachedEmployees)
      return {
        added,
        updated,
        total: cachedEmployees.length,
      }
    } catch (error) {
      console.error(`[SyncEmployees] Error (attempt ${retryCount + 1}):`, error)
      
      if (retryCount < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS)
        return this.syncEmployees(retryCount + 1)
      }
      
      throw error
    }
  },

  async getCachedEmployees(): Promise<CachedEmployee[]> {
    return offlineEmployeesStore.getAllEmployees()
  },

  async hasEmployees(): Promise<boolean> {
    const count = await offlineEmployeesStore.count()
    return count > 0
  },

  async clearCache(): Promise<void> {
    await offlineEmployeesStore.clearAll()
  },
}