import { OFFLINE_STORE_NAMES } from '@/modules/offline/storage/offline-db.types'
import { withStore, wrapRequest } from '@/modules/offline/storage/offline-db'
import type { OfflineOrder } from '@/modules/offline/types/offline.types'

export const offlineOrdersStore = {
  saveOrder(order: OfflineOrder) {
    return withStore(OFFLINE_STORE_NAMES.orders, 'readwrite', async (store) => {
      await wrapRequest(store.put(order))
    })
  },

  getOrder(localId: string) {
    return withStore(OFFLINE_STORE_NAMES.orders, 'readonly', (store) =>
      wrapRequest<OfflineOrder | undefined>(store.get(localId))
    )
  },

  getOrders() {
    return withStore(OFFLINE_STORE_NAMES.orders, 'readonly', (store) =>
      wrapRequest<OfflineOrder[]>(store.getAll())
    )
  },

  updateOrder(order: OfflineOrder) {
    return withStore(OFFLINE_STORE_NAMES.orders, 'readwrite', async (store) => {
      await wrapRequest(store.put(order))
    })
  },

  deleteOrder(localId: string) {
    return withStore(OFFLINE_STORE_NAMES.orders, 'readwrite', async (store) => {
      await wrapRequest(store.delete(localId))
    })
  },
}

