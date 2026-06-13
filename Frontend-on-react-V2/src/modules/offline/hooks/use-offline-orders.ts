import { useEffect, useState } from 'react'
import { offlineRepository } from '@/modules/offline/repositories/offline.repository'
import { offlineMediaRepository } from '@/modules/offline/repositories/offline-media.repository'
import type { OfflineOrder, OfflineStatus } from '@/modules/offline/types/offline.types'

export interface OfflineOrderListItem {
  localId: string
  clientGeneratedId: string
  createdAt: string
  status: OfflineStatus
  photoCount: number
  videoCount: number
  order: OfflineOrder
  ownerFullName: string
}

export function useOfflineOrders() {
  const [items, setItems] = useState<OfflineOrderListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setIsLoading(true)

      const orders = await offlineRepository.getOfflineOrders()
      // Убрана фильтрация по currentEmployee - показываем ВСЕ заказы

      const mapped = await Promise.all(
        orders.map(async (order) => {
          const media = await offlineMediaRepository.getOrderMedia(order.localId)

          return {
            localId: order.localId,
            clientGeneratedId: order.clientGeneratedId,
            createdAt: order.createdAt,
            status: order.status,
            photoCount: media.filter((item) => item.type === 'photo').length,
            videoCount: media.filter((item) => item.type === 'video').length,
            order,
            ownerFullName: order.ownerFullName,
          } satisfies OfflineOrderListItem
        })
      )

      if (!cancelled) {
        setItems(mapped.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
        setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, []) // Убрана зависимость от currentEmployee

  return {
    items,
    isLoading,
  }
}