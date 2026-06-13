import { OFFLINE_STORE_NAMES } from '@/modules/offline/storage/offline-db.types'
import { withStore, wrapRequest } from '@/modules/offline/storage/offline-db'
import type { OfflineStatus, SyncQueueItem } from '@/modules/offline/types/offline.types'

function updateQueueItem(
  item: SyncQueueItem,
  status: OfflineStatus,
  extra?: Partial<SyncQueueItem>
): SyncQueueItem {
  return {
    ...item,
    ...extra,
    status,
  }
}

export const offlineSyncQueueStore = {
  enqueue(item: SyncQueueItem) {
    return withStore(OFFLINE_STORE_NAMES.syncQueue, 'readwrite', async (store) => {
      await wrapRequest(store.put(item))
    })
  },

  dequeue(orderLocalId: string) {
    return withStore(OFFLINE_STORE_NAMES.syncQueue, 'readwrite', async (store) => {
      await wrapRequest(store.delete(orderLocalId))
    })
  },

  getPending() {
    return withStore(OFFLINE_STORE_NAMES.syncQueue, 'readonly', async (store) => {
      const index = store.index('status')
      const pending = await wrapRequest<SyncQueueItem[]>(index.getAll('pending'))
      const failed = await wrapRequest<SyncQueueItem[]>(index.getAll('failed'))

      return [...pending, ...failed].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      )
    })
  },

  async markFailed(orderLocalId: string) {
    const item = await this.get(orderLocalId)
    if (!item) return

    return withStore(OFFLINE_STORE_NAMES.syncQueue, 'readwrite', async (store) => {
      await wrapRequest(
        store.put(
          updateQueueItem(item, 'failed', {
            attemptsCount: item.attemptsCount + 1,
            lastAttemptAt: new Date().toISOString(),
          })
        )
      )
    })
  },

  async markSyncing(orderLocalId: string) {
    const item = await this.get(orderLocalId)
    if (!item) return

    return withStore(OFFLINE_STORE_NAMES.syncQueue, 'readwrite', async (store) => {
      await wrapRequest(
        store.put(
          updateQueueItem(item, 'syncing', {
            attemptsCount: item.attemptsCount + 1,
            lastAttemptAt: new Date().toISOString(),
          })
        )
      )
    })
  },

  getByStatus(status: OfflineStatus) {
    return withStore(OFFLINE_STORE_NAMES.syncQueue, 'readonly', (store) => {
      const index = store.index('status')

      return wrapRequest<SyncQueueItem[]>(index.getAll(status))
    })
  },

  async markSynced(orderLocalId: string) {
    const item = await this.get(orderLocalId)
    if (!item) return

    return withStore(OFFLINE_STORE_NAMES.syncQueue, 'readwrite', async (store) => {
      await wrapRequest(
        store.put(
          updateQueueItem(item, 'synced', {
            lastAttemptAt: new Date().toISOString(),
          })
        )
      )
    })
  },

  get(orderLocalId: string) {
    return withStore(OFFLINE_STORE_NAMES.syncQueue, 'readonly', (store) =>
      wrapRequest<SyncQueueItem | undefined>(store.get(orderLocalId))
    )
  },
}
