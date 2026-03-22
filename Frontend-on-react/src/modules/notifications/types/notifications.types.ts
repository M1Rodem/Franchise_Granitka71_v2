import type { NotificationType } from '@/shared/lib/signalr/signalr.types'

// ===== ENUMS =====

export const NotificationStatus = {
  Pending: 0,
  Approved: 1,
  Rejected: 2,
  Postponed: 3,
} as const

export type NotificationStatus =
  (typeof NotificationStatus)[keyof typeof NotificationStatus]

// ===== FILTER =====

export type NotificationFilter =
  | 'active'
  | 'postponed'
  | 'history'
  | 'all'
  | 'pending'

// ===== DTO =====

export interface NotificationResponseDto {
  id: number
  recipientId: number
  type: NotificationType
  status: NotificationStatus
  title: string
  message: string
  createdAt: string
  resolvedAt?: string | null
  returnsAt?: string | null
  resolutionNote?: string | null
  changes: NotificationChangesDto
  userId: number
  userName: string
  initiatorId?: number | null
  initiatorName: string
  orderId?: number | null
  orderNumber: string
  isInfluencing: boolean
  isBlocking: boolean
  isInformation: boolean
  minutesUntilReturn: number
  isActionRequired: boolean
  canPostpone: boolean
  isImpactForCurrentUser: boolean
}

// ===== DETAILS =====

export interface NotificationDetailsDto {
  id: number
  type: string
  status: NotificationStatus
  createdAt: string
  order: OrderShortDto
  initiator: InitiatorDto
  comment?: string | null
  changes: NotificationChangesDto
}

export interface OrderShortDto {
  id: number
  number: string
}

export interface InitiatorDto {
  id?: number | null
  name: string
}

export interface FieldChangeDto {
  field: string
  label: string
  oldValue?: string | null
  newValue?: string | null
}

export interface MapStateDto {
  latitude?: number | null
  longitude?: number | null
  plot?: string | null
  plotLatitude?: number | null
  plotLongitude?: number | null
  inspectionPlace?: string | null
  distanceKm?: number | null
}

export interface MapChangeDto {
  old: MapStateDto
  new: MapStateDto
}

export interface WorkItemDto {
  workDescription: string
  quantity: number
  price: number
  note?: string | null
}

export interface WorksChangeDto {
  oldWorks: WorkItemDto[]
  newWorks: WorkItemDto[]
  oldTotal: number
  newTotal: number
}

export interface PaymentDto {
  paymentType: string
  amount: number
  paymentDate: string
  note?: string | null
}

export interface PaymentsChangeDto {
  oldPayments: PaymentDto[]
  newPayments: PaymentDto[]
}

export interface MediaItemDto {
  id: number
  type: string
  previewUrl: string
}

export interface MediaChangeDto {
  deletedMedia: MediaItemDto[]
  addedMedia: MediaItemDto[]
}

export interface FinanceStateDto {
  worksTotal: number
  discount: number
  discountAmount: number
  total: number
  paid: number
  remaining: number
}

export interface FinanceChangeDto {
  old: FinanceStateDto
  new: FinanceStateDto
}

export interface NotificationChangesDto {
  mainInfo?: FieldChangeDto[]
  client?: FieldChangeDto[]
  map?: MapChangeDto
  works?: WorksChangeDto
  payments?: PaymentsChangeDto
  finance?: FinanceChangeDto
  media?: MediaChangeDto
}

// ===== BADGE =====

export interface NotificationBadgeDto {
  count: number
  color: 'red' | 'blue' | 'gray' | 'none'
}

// ===== REQUESTS =====

export type ResolveNotificationStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Postponed'

export interface ResolveNotificationRequest {
  status: ResolveNotificationStatus
  note?: string
}

export interface PostponeNotificationRequest {
  minutes?: number
  reason?: string
}