import type { NotificationUpdateDto } from '@/shared/lib/signalr/signalr.types'
import type { NotificationResponseDto } from '../types/notifications.types'
import { NotificationStatus } from '../types/notifications.types'

export function mapNotificationToStore(
  dto: NotificationUpdateDto
): NotificationResponseDto {
  const isPending = dto.status === NotificationStatus.Pending

  return {
    id: dto.id,
    type: dto.type,
    status: dto.status,
    title: dto.title,
    message: dto.message,
    createdAt: dto.createdAt,

    resolvedAt: null,
    returnsAt: dto.returnsAt ?? null,
    resolutionNote: null,

    changes: null,

    recipientId: 0,
    userId: 0,
    userName: dto.initiatorName,

    initiatorId: null,
    initiatorName: dto.initiatorName,

    orderId: dto.orderId ?? null,
    orderNumber: dto.orderNumber ?? '',

    isInfluencing: false,
    isBlocking: false,
    isInformation: false,

    minutesUntilReturn: 0,

    isActionRequired: isPending,
    canPostpone: isPending,

    isImpactForCurrentUser: false,
  }
}