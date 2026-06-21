import type { CreateOrderRequestDto } from '@/modules/orders/api/orders.api'

export type OfflineStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export type OfflineCreateOrderPayload = Omit<
  CreateOrderRequestDto,
  'tempPhotoIds' | 'tempVideoIds'
>

export interface OfflineOrder {
  localId: string
  clientGeneratedId: string
  displayId: string
  createdAt: string
  updatedAt: string
  status: OfflineStatus
  payload: OfflineCreateOrderPayload
  // Поля владельца
  ownerUserId: number
  ownerUsername: string
  ownerFullName: string
}

export interface OfflineMedia {
  id: string
  orderLocalId: string
  type: 'photo' | 'video'
  fileName: string
  size: number
  mimeType: string
  blob: Blob
  createdAt: string
}

export interface SyncQueueItem {
  orderLocalId: string
  createdAt: string
  attemptsCount: number
  lastAttemptAt: string | null
  status: OfflineStatus
}