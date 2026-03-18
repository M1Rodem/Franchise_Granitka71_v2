import { z } from 'zod';

// ===========================================
// БАЗОВЫЙ DTO (совпадает с SignalR и List API)
// ===========================================

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(['impact', 'snoozed', 'system']),
  status: z.string(),
  message: z.string().optional(),
  createdAt: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  initiatorName: z.string(),
  title: z.string(),
});

export type NotificationDto = z.infer<typeof notificationSchema>;

// ===========================================
// DTO ДЛЯ ДЕТАЛЕЙ (с изменениями)
// ===========================================

// === MAIN INFO CHANGES ===
export interface MainInfoChange {
  old: string | number | null;
  new: string | number | null;
}

export type MainInfoChanges = Partial<Record<
  | 'fullName'
  | 'email'
  | 'phone'
  | 'address'
  | 'deceasedFullName'
  | 'monumentType'
  | 'monumentSize'
  | 'managerFullName'
  | 'orderDate'
  | 'createdAt'
  | 'updatedAt',
  MainInfoChange
>>;

// === MAP CHANGES ===
export interface MapChanges {
  old: {
    lat: number;
    lng: number;
    place: string;
    inspectionPlace: string;
    plotName: string;
    distance?: number;
  };
  new: {
    lat: number;
    lng: number;
    place: string;
    inspectionPlace: string;
    plotName: string;
    distance?: number;
  };
}

// === WORKS CHANGES ===
export interface WorkItem {
  id?: number;
  workDescription: string;
  price: number;
  quantity: number;
  note?: string;
  distanceKm?: number | null;
}

export interface WorksChanges {
  old: WorkItem[];
  new: WorkItem[];
}

// === PAYMENTS CHANGES ===
export interface PaymentItem {
  id?: number;
  amount: number;
  paymentDate: string;
  paymentType: string;
  note?: string;
}

export interface PaymentsChanges {
  old: PaymentItem[];
  new: PaymentItem[];
}

// === FINANCIAL CHANGES ===
export interface FinancialChanges {
  subtotal: MainInfoChange;
  discountPercent: MainInfoChange;
  discountAmount: MainInfoChange;
  totalPrice: MainInfoChange;
  paid: MainInfoChange;
  remaining: MainInfoChange;
}

// === MEDIA CHANGES ===
export interface MediaItem {
  id?: number;
  url: string;
  originalFileName: string;
  size: number;
  uploadedAt: string;
  width?: number;
  height?: number;
  mediaType: number | string;
}

export interface MediaChanges {
  added: MediaItem[];
  removed: MediaItem[];
}

// === ROOT CHANGES OBJECT ===
export interface NotificationChanges {
  mainInfo?: MainInfoChanges;
  map?: MapChanges;
  works?: WorksChanges;
  payments?: PaymentsChanges;
  financial?: FinancialChanges;
  media?: MediaChanges;
}

// === DETAILS DTO ===
export const notificationDetailsSchema = notificationSchema.extend({
  changes: z.custom<NotificationChanges>(),
});

export type NotificationDetailsDto = z.infer<typeof notificationDetailsSchema>;

// ===========================================
// REALTIME EVENTS DTO
// ===========================================

export interface NotificationResolvedEvent {
  notificationId: string;
  status: 'approved' | 'rejected';
  resolvedBy: string;
  resolvedAt: string;
  note?: string;
  orderId: string;
  orderNumber: string;
}

export interface NotificationPostponedEvent {
  notificationId: string;
  returnsAt: string;
  minutes: number;
}

// ===========================================
// API RESPONSES
// ===========================================

export interface NotificationsListResponse {
  items: NotificationDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UnreadCountResponse {
  count: number;
}

// ===========================================
// FILTERS
// ===========================================

export type NotificationsFilterType = 'all' | 'pending' | 'active' | 'postponed' | 'history';

export interface NotificationsListParams {
  status?: NotificationsFilterType;
  page?: number;
  pageSize?: number;
}