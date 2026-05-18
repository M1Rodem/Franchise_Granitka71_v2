import {
  NotificationStatus,
  NotificationType,
} from '@/shared/lib/signalr/signalr.types'

import type {
  NotificationUpdateDto,
} from '@/shared/lib/signalr/signalr.types'

import type {
  NotificationResponseDto,
} from '../types/notifications.types'

export function mapNotificationToStore(
  dto: NotificationUpdateDto
): NotificationResponseDto {
  const isPending =
    dto.status === NotificationStatus.Pending

  const isCompletionRequest =
    dto.type === NotificationType.CompletionRequest

  const isCompletionResult =
    dto.type === NotificationType.CompletionResult

  return {
    id: dto.id,

    type: dto.type,
    status: dto.status,

    title: dto.title,
    message: dto.message,

    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,

    resolvedAt: null,

    returnsAt: dto.returnsAt ?? null,
    resolutionNote: null,

    changes: {} as NotificationResponseDto['changes'],

    recipientId: 0,

    userId: 0,
    userName: dto.initiatorName,

    initiatorId: null,
    initiatorName: dto.initiatorName,

    orderId: dto.orderId ?? null,
    orderNumber: dto.orderNumber ?? '',

    completionData: dto.completionData ?? null,

    isInfluencing: isCompletionRequest,

    isBlocking: false,

    isInformation:
      isCompletionResult ||
      dto.type === NotificationType.System,

    minutesUntilReturn: 0,

    isActionRequired:
      isPending && isCompletionRequest,

    canPostpone:
      isPending && isCompletionRequest,

    isImpactForCurrentUser: false,
  }
}