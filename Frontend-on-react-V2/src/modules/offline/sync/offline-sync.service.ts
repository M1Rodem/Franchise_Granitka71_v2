import { offlineRepository } from '@/modules/offline/repositories/offline.repository'
import { offlineMediaRepository } from '@/modules/offline/repositories/offline-media.repository'
import { offlineSyncQueueStore } from '@/modules/offline/storage/offline-sync-queue.store'
import { offlinePlotsService } from '@/modules/offline/services/offline-plots.service'
import axios from 'axios'
import { env } from '@/shared/config/env'
import { calculateDistanceViaYmaps } from '@/shared/lib/yandex-map/utils/calculateDistance'
import { connectivityService } from '../services/connectivity.service'
import { tempMessage } from '@/shared/ui/temp-message.service'
import { tilePrecacheService } from '@/modules/pwa/services/tilePrecache.service'

function createAuthenticatedClient(token: string) {
  return axios.create({
    baseURL: env.apiBaseUrl,
    timeout: 30000,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
}

export const offlineSyncService = {
  async syncOrder(orderLocalId: string, authToken: string) {
    if (!authToken) {
      throw new Error('Токен авторизации обязателен для синхронизации')
    }

    const order = await offlineRepository.getOfflineOrder(orderLocalId)

    if (!order) {
      throw new Error(`Offline order ${orderLocalId} not found`)
    }

    await offlineSyncQueueStore.markSyncing(orderLocalId)

    const client = createAuthenticatedClient(authToken)
    
    try {
      const media = await offlineMediaRepository.getOrderMedia(orderLocalId)

      const photoTempIds: number[] = []
      const videoTempIds: number[] = []

      for (const item of media) {
        const formData = new FormData()
        const file = new File([item.blob], item.fileName, {
          type: item.mimeType,
          lastModified: Date.now(),
        })
        formData.append('file', file)

        const uploadResponse = await client.post(`/media/upload-temp?type=${item.type}&source=offline`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        if (item.type === 'photo') {
          photoTempIds.push(uploadResponse.data.id)
        } else {
          videoTempIds.push(uploadResponse.data.id)
        }
      }

      // ===== ПЕРЕСЧЁТ РАССТОЯНИЯ ЧЕРЕЗ JS API =====
      let updatedWorkItems = order.payload.workItems

      const isOnline = connectivityService.isOnline()
      
      const distanceWorkIndex = order.payload.workItems.findIndex(
        w => w.isDistanceWork === true && w.distanceKm === 0
      )

      if (distanceWorkIndex !== -1 && isOnline) {
        const plotId = order.payload.plotId
        const lat = order.payload.latitude
        const lng = order.payload.longitude

        if (plotId && lat && lng) {
          try {
            const plots = await offlinePlotsService.getCachedPlots()
            const plot = plots.find(p => p.id === plotId)

            if (plot) {
              const distanceKm = await calculateDistanceViaYmaps(
                plot.latitude,
                plot.longitude,
                lat,
                lng
              )

              if (distanceKm > 0) {
                updatedWorkItems = order.payload.workItems.map((w, index) => {
                  if (index === distanceWorkIndex) {
                    return { ...w, distanceKm }
                  }
                  return w
                })
              } else {
                console.warn(`[Sync] Получено нулевое расстояние, оставляем 0`)
              }
            } else {
              console.warn(`[Sync] Участок с id ${plotId} не найден в кеше`)
            }
          } catch (error) {
            console.warn(`[Sync] Не удалось пересчитать расстояние через JS API:`, error)
          }
        }
      }

      await client.post('/orders', {
        ...order.payload,
        workItems: updatedWorkItems,
        clientGeneratedId: order.clientGeneratedId,
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
    }
  },

  async syncUserOrders(
    userId: number,
    authToken: string,
    onProgress?: (current: number, total: number) => void
  ) {
    if (!authToken) {
      throw new Error('Токен авторизации обязателен')
    }

    const allOrders = await offlineRepository.getOfflineOrders()
    const userOrders = allOrders.filter((order) => order.ownerUserId === userId)
    
    if (userOrders.length === 0) {
      return { success: 0, failed: 0, total: 0 }
    }

    const results = {
      success: 0,
      failed: 0,
      total: userOrders.length,
    }

    const syncedOrders: Array<{ 
      displayId: string; 
      localId: string;
      hasZeroDistance: boolean;
    }> = []

    let processed = 0

    for (const order of userOrders) {
      const hasZeroDistance = order.payload.workItems.some(
        w => w.isDistanceWork === true && w.distanceKm === 0
      )
      
      syncedOrders.push({
        displayId: order.displayId || order.localId,
        localId: order.localId,
        hasZeroDistance
      })

      try {
        await this.syncOrder(order.localId, authToken)
        results.success++
      } catch (error) {
        console.error(`Failed to sync order ${order.localId}:`, error)
        results.failed++
      } finally {
        processed++
        if (onProgress) {
          onProgress(processed, userOrders.length)
        }
      }
    }

    try {
      await tilePrecacheService.refreshYandexApiIfNeeded()
    } catch (error) {
      console.warn('[Sync] Не удалось обновить API кеш:', error)
    }

    if (syncedOrders.length > 0) {
      const orderNumbers = syncedOrders
        .map(o => `№${o.displayId}`)
        .join(', ')
      
      const hasAnyZeroDistance = syncedOrders.some(o => o.hasZeroDistance)
      
      if (hasAnyZeroDistance) {
        tempMessage.warning(
          `Заказы ${orderNumbers} синхронизированы. Проверьте маршрут и расстояние.`,
          {
            durationMs: 8000,
            position: 'topRight',
            showProgress: true,
            closable: true,
          }
        )
        console.log(`[Sync] Заказы с нулевым расстоянием:`, 
          syncedOrders.filter(o => o.hasZeroDistance).map(o => o.displayId).join(', '))
      } else {
        tempMessage.success(
          `Заказы ${orderNumbers} успешно синхронизированы.`,
          {
            durationMs: 5000,
            position: 'topRight',
            showProgress: true,
            closable: true,
          }
        )
      }
    }

    return results
  },

  async syncAll() {
    throw new Error('syncAll не поддерживается. Используйте syncUserOrders с токеном пользователя.')
  },

  async retryFailed() {
    throw new Error('retryFailed не поддерживается. Используйте syncUserOrders с токеном пользователя.')
  },

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