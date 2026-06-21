import type { OrderFormModel } from '@/modules/orders/components/order-form/order-form.schema'
import type { OfflineCreateOrderPayload, OfflineOrder, OfflineStatus } from '@/modules/offline/types/offline.types'

import { generateDisplayId, generateClientGeneratedId } from '@/modules/offline/utils/offline-id'

export const OFFLINE_CREATE_DRAFT_STORAGE_KEY = 'offline-create-draft-local-id'

export interface CreateOfflineOrderInput {
  localId: string
  payload: OfflineCreateOrderPayload
  clientGeneratedId?: string
  displayId?: string
  createdAt?: string
  updatedAt?: string
  status?: OfflineStatus
  ownerUserId: number
  ownerUsername: string
  ownerFullName: string
}

export function createOfflineOrderDraft({
  localId,
  payload,
  clientGeneratedId = generateClientGeneratedId(),
  displayId = generateDisplayId(),
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
  status = 'pending',
  ownerUserId,
  ownerUsername,
  ownerFullName,
}: CreateOfflineOrderInput): OfflineOrder {
  return {
    localId,
    clientGeneratedId,
    displayId,
    createdAt,
    updatedAt,
    status,
    payload,
    ownerUserId,
    ownerUsername,
    ownerFullName,
  }
}

export function getOrCreateOfflineDraftLocalId(): string {
  const existing = localStorage.getItem(OFFLINE_CREATE_DRAFT_STORAGE_KEY)

  if (existing) {
    return existing
  }

  const localId = crypto.randomUUID()
  localStorage.setItem(OFFLINE_CREATE_DRAFT_STORAGE_KEY, localId)
  return localId
}

export function clearOfflineDraftLocalId() {
  localStorage.removeItem(OFFLINE_CREATE_DRAFT_STORAGE_KEY)
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')

  if (digits.startsWith('8') && digits.length === 11) {
    digits = '7' + digits.slice(1)
  }

  return digits
}

export function mapFormToOfflineCreatePayload(values: OrderFormModel): OfflineCreateOrderPayload {
  return {
    place: values.inspectionPlace,
    inspectionPlace: values.inspectionPlace,
    orderDate: values.orderDate,
    latitude: values.latitude,
    longitude: values.longitude,
    plotId: values.plotId,
    deceasedFullName: values.deceasedFullName,
    customerFullName: values.client.fullName,
    customerEmail: values.client.email || null,
    phone: normalizePhone(values.client.phone),
    address: values.client.address,
    monumentType: values.monument.type,
    monumentSize: values.monument.size,
    additionalInfo: values.additionalInfo,
    discountPercent: values.discountPercent,
    workItems: values.works.map((w) => {
      const isDistance = w.isDistanceWork === true

      if (isDistance) {
        return {
          workDescription: w.workDescription,
          price: w.price,
          routes: w.routes ?? 1,
          distanceKm: w.distanceKm ?? 0,
          isDistanceWork: true,
          note: w.note,
        }
      }

      return {
        workDescription: w.workDescription,
        price: w.price,
        quantity: w.quantity ?? 0,
        isDistanceWork: false,
        note: w.note,
      }
    }),
    payments: values.payments.map((p) => ({
      amount: p.amount,
      paymentDate: p.paymentDate,
      paymentType: p.paymentType,
      note: p.note,
    })),
  }
}