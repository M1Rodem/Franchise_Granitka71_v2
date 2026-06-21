import { offlineMediaStore } from '@/modules/offline/storage/offline-media.store'
import type { OfflineMedia } from '@/modules/offline/types/offline.types'

export const offlineMediaRepository = {
  async saveOrderMedia(media: OfflineMedia) {
    await offlineMediaStore.saveMedia(media)
    return media
  },

  getOrderMedia(orderLocalId: string) {
    return offlineMediaStore.getMediaByOrder(orderLocalId)
  },

  deleteOrderMedia(id: string) {
    return offlineMediaStore.deleteMedia(id)
  },
}
