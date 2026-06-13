import { ordersApi } from '@/modules/orders/api/orders.api'
import { offlineRepository } from '@/modules/offline/repositories/offline.repository'
import { offlineMediaRepository } from '@/modules/offline/repositories/offline-media.repository'
import { offlineSyncQueueStore } from '@/modules/offline/storage/offline-sync-queue.store'
import { mediaApi } from '@/shared/lib/media/api/media.api'
import { httpClient } from '@/shared/api/http-client'


export const offlineSyncService = {
  async syncOrder(orderLocalId: string, authToken: string) {
    const order = await offlineRepository.getOfflineOrder(orderLocalId)

    if (!order) {
      throw new Error(`Offline order ${orderLocalId} not found`)
    }

    await offlineSyncQueueStore.markSyncing(orderLocalId)

    // Создаем временный httpClient с токеном пользователя
    const tempClient = httpClient
    const originalToken = tempClient.defaults.headers.common['Authorization']
    
    try {
      // Подменяем токен
      tempClient.defaults.headers.common['Authorization'] = `Bearer ${authToken}`

      const media = await offlineMediaRepository.getOrderMedia(orderLocalId)

      const photoTempIds: number[] = []
      const videoTempIds: number[] = []

      for (const item of media) {
        const file = new File([item.blob], item.fileName, {
          type: item.mimeType,
          lastModified: Date.now(),
        })

        if (item.type === 'photo') {
          const uploaded = await mediaApi.uploadTemp(file, 'photo')
          photoTempIds.push(uploaded.id)
        } else {
          const uploaded = await mediaApi.uploadTemp(file, 'video')
          videoTempIds.push(uploaded.id)
        }
      }

      await ordersApi.createOrder({
        ...order.payload,
        tempPhotoIds: photoTempIds,
        tempVideoIds: videoTempIds,
        ownerUserId: order.ownerUserId,
      })

      for (const item of media) {
        await offlineMediaRepository.deleteOrderMedia(item.id)
      }

      await offlineRepository.deleteOfflineOrder(orderLocalId)

      return true
    } catch (error) {
      await offlineSyncQueueStore.markFailed(orderLocalId)
      throw error
    } finally {
      // Восстанавливаем оригинальный токен
      if (originalToken) {
        tempClient.defaults.headers.common['Authorization'] = originalToken
      } else {
        delete tempClient.defaults.headers.common['Authorization']
      }
    }
  },

  // Синхронизация заказов конкретного пользователя
  async syncUserOrders(userId: number, authToken: string) {
    // Получаем все оффлайн заказы
    const allOrders = await offlineRepository.getOfflineOrders()
    
    // Фильтруем только заказы этого пользователя
    const userOrders = allOrders.filter((order) => order.ownerUserId === userId)
    
    if (userOrders.length === 0) {
      return { success: 0, failed: 0, total: 0 }
    }

    const results = {
      success: 0,
      failed: 0,
      total: userOrders.length,
    }

    for (const order of userOrders) {
      try {
        await this.syncOrder(order.localId, authToken)
        results.success++
      } catch (error) {
        console.error(`Failed to sync order ${order.localId}:`, error)
        results.failed++
      }
    }

    return results
  },

  async syncAll() {
    const queue = await offlineSyncQueueStore.getPending()

    const results = {
      success: 0,
      failed: 0,
    }

    for (const item of queue) {
      try {
        await this.syncOrder(item.orderLocalId, '')
        results.success++
      } catch {
        results.failed++
      }
    }

    return results
  },

  async retryFailed() {
    const failedOrders = await offlineSyncQueueStore.getByStatus('failed')

    const results = {
      success: 0,
      failed: 0,
    }

    for (const item of failedOrders) {
      try {
        await this.syncOrder(item.orderLocalId, '')
        results.success++
      } catch {
        results.failed++
      }
    }

    return results
  },

  // Получить группировку заказов по сотрудникам
  async getOrdersGroupedByOwner() {
    const allOrders = await offlineRepository.getOfflineOrders()
    const grouped = new Map<number, { fullName: string; count: number }>()

    for (const order of allOrders) {
      const existing = grouped.get(order.ownerUserId)
      if (existing) {
        existing.count++
      } else {
        grouped.set(order.ownerUserId, {
          fullName: order.ownerFullName,
          count: 1,
        })
      }
    }

    return Array.from(grouped.entries()).map(([userId, data]) => ({
      userId,
      fullName: data.fullName,
      count: data.count,
    }))
  },
}