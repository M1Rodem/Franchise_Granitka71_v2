import { OFFLINE_STORE_NAMES } from '@/modules/offline/storage/offline-db.types'
import { withStore, wrapRequest } from '@/modules/offline/storage/offline-db'
import type { OfflineMedia } from '@/modules/offline/types/offline.types'

export const offlineMediaStore = {
  saveMedia(media: OfflineMedia) {
    return withStore(OFFLINE_STORE_NAMES.media, 'readwrite', async (store) => {
      await wrapRequest(store.put(media))
    })
  },

  getMedia(id: string) {
    return withStore(OFFLINE_STORE_NAMES.media, 'readonly', (store) =>
      wrapRequest<OfflineMedia | undefined>(store.get(id))
    )
  },

  getMediaByOrder(orderLocalId: string) {
    return withStore(OFFLINE_STORE_NAMES.media, 'readonly', (store) => {
      const index = store.index('orderLocalId')
      return wrapRequest<OfflineMedia[]>(index.getAll(orderLocalId))
    })
  },

  deleteMedia(id: string) {
    return withStore(OFFLINE_STORE_NAMES.media, 'readwrite', async (store) => {
      await wrapRequest(store.delete(id))
    })
  },
}

