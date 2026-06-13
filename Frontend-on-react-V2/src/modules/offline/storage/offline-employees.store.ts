import { OFFLINE_STORE_NAMES } from '@/modules/offline/storage/offline-db.types'
import { withStore, wrapRequest } from '@/modules/offline/storage/offline-db'
import type { CachedEmployee } from '@/modules/offline/types/offline-employees.types'

export const offlineEmployeesStore = {
  async saveEmployee(employee: CachedEmployee) {
    await withStore(OFFLINE_STORE_NAMES.employees, 'readwrite', async (store) => {
      await wrapRequest(store.put(employee))
    })
  },

  async saveEmployees(employees: CachedEmployee[]) {
    await withStore(OFFLINE_STORE_NAMES.employees, 'readwrite', async (store) => {
      for (const employee of employees) {
        await wrapRequest(store.put(employee))
      }
    })
  },

  async getAllEmployees(): Promise<CachedEmployee[]> {
    return withStore(OFFLINE_STORE_NAMES.employees, 'readonly', async (store) => {
      return wrapRequest<CachedEmployee[]>(store.getAll())
    })
  },

  async getEmployee(id: number): Promise<CachedEmployee | undefined> {
    return withStore(OFFLINE_STORE_NAMES.employees, 'readonly', async (store) => {
      return wrapRequest<CachedEmployee | undefined>(store.get(id))
    })
  },

  async getEmployeeByUsername(username: string): Promise<CachedEmployee | undefined> {
    return withStore(OFFLINE_STORE_NAMES.employees, 'readonly', async (store) => {
      const index = store.index('username')
      const employees = await wrapRequest<CachedEmployee[]>(index.getAll(username))
      return employees[0]
    })
  },

  async deleteEmployee(id: number) {
    await withStore(OFFLINE_STORE_NAMES.employees, 'readwrite', async (store) => {
      await wrapRequest(store.delete(id))
    })
  },

  async clearAll() {
    await withStore(OFFLINE_STORE_NAMES.employees, 'readwrite', async (store) => {
      await wrapRequest(store.clear())
    })
  },

  async count(): Promise<number> {
    return withStore(OFFLINE_STORE_NAMES.employees, 'readonly', async (store) => {
      return wrapRequest<number>(store.count())
    })
  },
}