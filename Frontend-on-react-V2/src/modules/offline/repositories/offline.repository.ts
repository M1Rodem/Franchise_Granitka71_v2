import { offlineOrdersStore } from '@/modules/offline/storage/offline-orders.store'
import { offlineSyncQueueStore } from '@/modules/offline/storage/offline-sync-queue.store'
import type { OfflineOrder } from '@/modules/offline/types/offline.types'

export const offlineRepository = {
  async createOfflineOrder(order: OfflineOrder) {
    await offlineOrdersStore.saveOrder(order)
    await offlineSyncQueueStore.enqueue({
      orderLocalId: order.localId,
      createdAt: order.createdAt,
      attemptsCount: 0,
      lastAttemptAt: null,
      status: order.status,
    })

    return order
  },

  async updateOfflineOrder(order: OfflineOrder) {
    await offlineOrdersStore.updateOrder(order)
    return order
  },

  async deleteOfflineOrder(localId: string) {
    await offlineOrdersStore.deleteOrder(localId)
    await offlineSyncQueueStore.dequeue(localId)
  },

  getOfflineOrders() {
    return offlineOrdersStore.getOrders()
  },

  getOfflineOrder(localId: string) {
    return offlineOrdersStore.getOrder(localId)
  },
}

