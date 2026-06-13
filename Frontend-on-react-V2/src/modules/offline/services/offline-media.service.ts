import type { OfflineMedia } from '@/modules/offline/types/offline.types'

const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024
const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024

export function validateOfflineMediaFile(file: File, type: 'photo' | 'video') {
  const maxSize = type === 'photo' ? MAX_PHOTO_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES

  if (file.size > maxSize) {
    throw new Error(
      type === 'photo'
        ? 'Размер фото превышает 20 МБ'
        : 'Размер видео превышает 500 МБ'
    )
  }
}

export function createOfflineMedia(params: {
  orderLocalId: string
  file: File
  type: 'photo' | 'video'
}): OfflineMedia {
  const { orderLocalId, file, type } = params

  validateOfflineMediaFile(file, type)

  return {
    id: crypto.randomUUID(),
    orderLocalId,
    type,
    fileName: file.name,
    size: file.size,
    mimeType: file.type,
    blob: file,
    createdAt: new Date().toISOString(),
  }
}
