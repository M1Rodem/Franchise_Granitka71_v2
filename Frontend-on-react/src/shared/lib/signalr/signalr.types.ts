// ===== ENUMS (без enum из-за erasableSyntaxOnly) =====

export const NotificationType = {
  OrderUpdateRequest: 0,
  OrderCompletionConfirmation: 1,
  System: 2,
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
  orderId?: number | null
  orderNumber?: string | null
  initiatorName: string
  returnsAt?: string | null
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
  unreadCount: number
}

// ===== EVENTS =====

export interface NotificationEvents {
  receivenotification: (payload: NotificationUpdateDto) => void
  updatenotificationcount: (payload: NotificationBadgeDto) => void
  updatenotification: (payload: NotificationUpdateDto) => void
  notificationresolved: (payload: NotificationResolvedDto) => void
  notificationpostponed: (payload: NotificationPostponedDto) => void
  notificationseen: (notificationId: number) => void
  connectionestablished: (message: string) => void
  connectionlost: (message: string) => void
  initialnotificationstate: (payload: InitialNotificationStateDto) => void
}

// ===== SERVER METHODS =====

export type SignalRServerMethods =
  | 'RequestCurrentState'
  | 'MarkAsSeen'