// ===== ENUMS (без enum из-за erasableSyntaxOnly) =====

export const NotificationType = {
  OrderUpdateRequest: 0,
  OrderCompletionConfirmation: 1,
  System: 2,

  CompletionRequest: 3,
  CompletionResult: 4,
} as const

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType]

export const NotificationStatus = {
  Pending: 0,
  Approved: 1,
  Rejected: 2,
  Postponed: 3,
} as const

export type NotificationStatus =
  (typeof NotificationStatus)[keyof typeof NotificationStatus]

// ===== DTO =====

export interface NotificationUpdateDto {
  id: number
  type: NotificationType
  status: NotificationStatus

  title: string
  message: string

  createdAt: string
  updatedAt: string

  orderId?: number | null
  orderNumber?: string | null

  initiatorName: string

  returnsAt?: string | null

  completionData?: CompletionDataDto | null
}

export interface NotificationBadgeDto {
  count: number
  color: 'red' | 'blue' | 'gray' | 'none'
}

export interface NotificationResolvedDto {
  notificationId: number
  status: NotificationStatus
  resolvedBy: string
  resolvedAt: string
  note?: string | null
  orderId?: number | null
  orderNumber?: string | null
}

export interface NotificationPostponedDto {
  notificationId: number
  returnsAt: string
  minutes: number
}

export interface InitialNotificationStateDto {
  count: number
  color: 'red' | 'blue' | 'gray' | 'none'
}

export interface NotificationCountsDto {
  active: number
  postponed: number
  history: number
  all: number

  hasActiveNonSystem: boolean
  hasPostponed: boolean
  hasOnlySystem: boolean
}

// ===== COMPLETION =====

export const CompletionStatus = {
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
} as const

export type CompletionStatus =
  (typeof CompletionStatus)[keyof typeof CompletionStatus]

export const CompletionMediaType = {
  Photo: 0,
  Video: 1,
} as const

export type CompletionMediaType =
  (typeof CompletionMediaType)[keyof typeof CompletionMediaType]

export interface CompletionMediaDto {
  id: number
  url: string
  originalFileName: string
  size: number
  uploadedAt?: string
  width: number
  height: number
  mediaType: CompletionMediaType
}

export interface CompletionDataDto {
  orderId: number
  orderNumber: string

  initiatorId: number
  initiatorName: string

  comment?: string | null

  photos: CompletionMediaDto[]
  video?: CompletionMediaDto | null

  createdAt: string
}

export interface CompletionResultDto {
  orderId: number
  orderNumber: string

  approved: boolean

  comment?: string | null

  reviewedAt: string
  reviewedByName: string
}

// ===== EVENTS =====

export interface NotificationEvents {
  'receivenotification': (notification: NotificationUpdateDto) => void
  'updatenotification': (notification: NotificationUpdateDto) => void
  'notificationresolved': (resolution: NotificationResolvedDto) => void
  'notificationpostponed': (postponement: NotificationPostponedDto) => void
  'updatenotificationcounts': (counts: NotificationCountsDto) => void
  'notificationseen': (notificationId: number) => void
  'connectionestablished': (message: string) => void
  'connectionlost': (message: string) => void
}

// ===== SERVER METHODS =====

export type SignalRServerMethods =
  | 'RequestCurrentState'
  | 'MarkAsSeen'