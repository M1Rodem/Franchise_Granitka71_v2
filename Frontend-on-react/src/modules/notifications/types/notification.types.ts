export const NotificationStatus = {
  Pending: 0,
  Approved: 1,
  Rejected: 2,
  Postponed: 3,
} as const

export type NotificationStatus =
  typeof NotificationStatus[keyof typeof NotificationStatus]

export type NotificationType =
  | 'OrderUpdateRequest'
  | 'System'
  | 'OrderCompletionConfirmation'

export interface NotificationDiffValue {
  old: unknown
  new: unknown
}

export type NotificationProposedChanges = Record<
  string,
  NotificationDiffValue
>

export interface NotificationData {
  proposedChanges?: NotificationProposedChanges
  comment?: string
  originalOrderSnapshot?: Record<string, unknown>
}

export interface NotificationItem {
  id: number

  type: NotificationType
  status: NotificationStatus

  title: string
  message: string

  createdAt: string
  resolvedAt?: string | null

  userId: number
  userName: string

  initiatorId: number
  initiatorName: string

  orderId?: number
  orderNumber?: string

  data?: NotificationData

  isInfluencing: boolean
  isBlocking: boolean
  isInformation: boolean

  minutesUntilReturn?: number

  isActionRequired: boolean
  canPostpone: boolean
}

export interface NotificationsResponse {
  items: NotificationItem[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}