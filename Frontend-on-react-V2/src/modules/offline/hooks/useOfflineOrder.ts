import { useEffect, useState } from 'react'
import { offlineRepository } from '@/modules/offline/repositories/offline.repository'
import { offlineMediaRepository } from '@/modules/offline/repositories/offline-media.repository'
import type { OfflineOrder } from '@/modules/offline/types/offline.types'

export interface OfflineOrderWithMedia extends OfflineOrder {
  photoCount: number
  videoCount: number
  media: Array<{
    id: string
    type: 'photo' | 'video'
    blob: Blob
    fileName: string
    mimeType: string
  }>
}

export function useOfflineOrder(localId: string | undefined) {
  const [order, setOrder] = useState<OfflineOrderWithMedia | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!localId) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    void (async () => {
      setIsLoading(true)
      setError(null)

      try {
        const offlineOrder = await offlineRepository.getOfflineOrder(localId)

        if (!offlineOrder) {
          throw new Error('Заказ не найден')
        }

        const media = await offlineMediaRepository.getOrderMedia(localId)

        if (!cancelled) {
          setOrder({
            ...offlineOrder,
            photoCount: media.filter((m) => m.type === 'photo').length,
            videoCount: media.filter((m) => m.type === 'video').length,
            media: media.map((m) => ({
              id: m.id,
              type: m.type,
              blob: m.blob,
              fileName: m.fileName,
              mimeType: m.mimeType,
            })),
          })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Ошибка загрузки заказа'))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [localId])

  return { order, isLoading, error }
}