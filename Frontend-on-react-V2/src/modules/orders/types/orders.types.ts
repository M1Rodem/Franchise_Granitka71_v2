import { z } from 'zod';

const orderCamelSchema = z
  .object({
    id: z.number().int(),
    orderNumber: z.string(),
    customerFullName: z.string(),
    phone: z.string().optional(),
    orderDate: z.string(),
    status: z.union([z.number().int(), z.string()]),
    managerFullName: z.string(),
    paymentStatus: z.union([z.number().int(), z.string()]).optional(),
    plotName: z.string().nullable().optional(),
  })
  .passthrough();

const orderPascalSchema = z
  .object({
    Id: z.number().int(),
    OrderNumber: z.string(),
    CustomerFullName: z.string(),
    Phone: z.string().optional(),
    OrderDate: z.string(),
    Status: z.union([z.number().int(), z.string()]),
    ManagerFullName: z.string(),
    PaymentStatus: z.union([z.number().int(), z.string()]).optional(),
    PlotName: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((value) => ({
    id: value.Id,
    orderNumber: value.OrderNumber,
    customerFullName: value.CustomerFullName,
    phone: value.Phone,
    orderDate: value.OrderDate,
    status: value.Status,
    managerFullName: value.ManagerFullName,
    paymentStatus: value.PaymentStatus,
    plotName: value.PlotName,
  }));

export const orderResponseDtoSchema = z.union([orderCamelSchema, orderPascalSchema]);

const ordersPagedResultCamelSchema = z
  .object({
    items: z.array(orderResponseDtoSchema),
    totalCount: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalPages: z.number().int(),
  })
  .passthrough();

const ordersPagedResultPascalSchema = z
  .object({
    Items: z.array(orderResponseDtoSchema),
    TotalCount: z.number().int(),
    Page: z.number().int(),
    PageSize: z.number().int(),
    TotalPages: z.number().int(),
  })
  .passthrough()
  .transform((value) => ({
    items: value.Items,
    totalCount: value.TotalCount,
    page: value.Page,
    pageSize: value.PageSize,
    totalPages: value.TotalPages,
  }));

export const ordersPagedResultSchema = z.union([ordersPagedResultCamelSchema, ordersPagedResultPascalSchema]);

export interface OrdersFilterParams {
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
  plotId: number | null;
  paymentStatus: number | null;
  completionStatus: number | null;
}

export interface OrdersListQueryParams extends OrdersFilterParams {
  page: number;
  pageSize: number;
}

export interface OrdersFiltersNormalized {
  searchQuery?: string;
  dateFrom?: string;
  dateTo?: string;
  plotId?: number;
  paymentStatus?: number;
  completionStatus?: number;
  page: number;
  pageSize: number;
}

export interface PlotFilterOption {
  id: number;
  name: string;
}

export type OrderResponseDto = z.infer<typeof orderResponseDtoSchema>;
export type OrdersPagedResultDto = z.infer<typeof ordersPagedResultSchema>;

// =========================
// Order Details Schemas
// =========================

const workItemCamelSchema = z.object({
  id: z.number().int(),
  orderId: z.number().int().optional(),
  workDescription: z.string(),
  price: z.number(),
  quantity: z.number(),
  routes: z.number().optional(),
  isDistanceWork: z.boolean().optional(),
  note: z.string().optional(),
  distanceKm: z.number().nullable().optional(),
}).passthrough();

const workItemPascalSchema = z.object({
  Id: z.number().int(),
  OrderId: z.number().int().optional(),
  WorkDescription: z.string(),
  Price: z.number(),
  Quantity: z.number(),
  Routes: z.number().optional(),
  IsDistanceWork: z.boolean().optional(),
  Note: z.string().optional(),
  DistanceKm: z.number().nullable().optional(),
}).passthrough().transform((v) => ({
  id: v.Id,
  orderId: v.OrderId,
  workDescription: v.WorkDescription,
  price: v.Price,
  quantity: v.Quantity,
  routes: v.Routes,
  isDistanceWork: v.IsDistanceWork,
  note: v.Note,
  distanceKm: v.DistanceKm,
}));

export const workItemSchema = z.union([workItemCamelSchema, workItemPascalSchema]);

const paymentCamelSchema = z.object({
  id: z.number().int(),
  orderId: z.number().int().optional(),
  amount: z.number(),
  paymentDate: z.string(),
  paymentType: z.string(),
  note: z.string().optional(),
}).passthrough();

const paymentPascalSchema = z.object({
  Id: z.number().int(),
  OrderId: z.number().int().optional(),
  Amount: z.number(),
  PaymentDate: z.string(),
  PaymentType: z.string(),
  Note: z.string().optional(),
}).passthrough().transform((v) => ({
  id: v.Id,
  orderId: v.OrderId,
  amount: v.Amount,
  paymentDate: v.PaymentDate,
  paymentType: v.PaymentType,
  note: v.Note,
}));

export const paymentSchema = z.union([paymentCamelSchema, paymentPascalSchema]);

const mediaCamelSchema = z.object({
  id: z.number().int(),
  url: z.string(),
  originalFileName: z.string(),
  size: z.number(),
  uploadedAt: z.string(),
  width: z.number(),
  height: z.number(),
  mediaType: z.union([z.number(), z.string()]),
  isOriginal: z.boolean().optional(),
}).passthrough();

const mediaPascalSchema = z.object({
  Id: z.number().int(),
  Url: z.string(),
  OriginalFileName: z.string(),
  Size: z.number(),
  UploadedAt: z.string(),
  Width: z.number(),
  Height: z.number(),
  MediaType: z.union([z.number(), z.string()]),
  IsOriginal: z.boolean().optional(),
}).passthrough().transform((v) => ({
  id: v.Id,
  url: v.Url,
  originalFileName: v.OriginalFileName,
  size: v.Size,
  uploadedAt: v.UploadedAt,
  width: v.Width,
  height: v.Height,
  mediaType: v.MediaType,
  isOriginal: v.IsOriginal
}));

export const mediaSchema = z.union([mediaCamelSchema, mediaPascalSchema]);

// =========================
// COMPLETION DTO
// =========================

const orderCompletionCamelSchema = z.object({
  submittedAt: z.string(),

  submittedBy: z.string(),

  submittedNote: z.string().nullable().optional(),

  media: z.array(mediaSchema),

  reviewedAt: z.string().nullable().optional(),

  reviewedBy: z.string().nullable().optional(),

  reviewComment: z.string().nullable().optional(),

  status: z.string().nullable().optional(),
}).passthrough()

const orderCompletionPascalSchema = z.object({
  SubmittedAt: z.string(),

  SubmittedBy: z.string(),

  SubmittedNote: z.string().nullable().optional(),

  Media: z.array(mediaSchema),

  ReviewedAt: z.string().nullable().optional(),

  ReviewedBy: z.string().nullable().optional(),

  ReviewComment: z.string().nullable().optional(),

  Status: z.string().nullable().optional(),
}).passthrough().transform((v) => ({
  submittedAt: v.SubmittedAt,

  submittedBy: v.SubmittedBy,

  submittedNote: v.SubmittedNote,

  media: v.Media,

  reviewedAt: v.ReviewedAt,

  reviewedBy: v.ReviewedBy,

  reviewComment: v.ReviewComment,

  status: v.Status,
}))

export const orderCompletionSchema = z.union([
  orderCompletionCamelSchema,
  orderCompletionPascalSchema,
])

export type OrderCompletionDto =
  z.infer<typeof orderCompletionSchema>

// =========================
// Order Details DTO
// =========================

const orderDetailsCamelSchema = z.object({
  id: z.number().int(),
  orderNumber: z.string(),
  place: z.string(),
  inspectionPlace: z.string(),
  orderDate: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  plotId: z.number().nullable().optional(),
  plotName: z.string().nullable().optional(),

  deceasedFullName: z.string(),
  customerFullName: z.string(),
  customerEmail: z.string().nullable().optional(),
  phone: z.string(),
  address: z.string(),

  monumentType: z.string().optional().nullable(),
  monumentSize: z.string().optional().nullable(),
  additionalInfo: z.string().optional().nullable(),

  status: z.union([z.number(), z.string()]),

  subtotal: z.number(),
  discountPercent: z.number(),
  discountAmount: z.number(),
  totalPrice: z.number(),

  createdAt: z.string(),
  updatedAt: z.string(),

  managerId: z.number().int(),
  managerFullName: z.string(),

  workItems: z.array(workItemSchema),
  payments: z.array(paymentSchema),
  photos: z.array(mediaSchema),

  completion: orderCompletionSchema.nullable().optional(),

  paymentStatus: z.union([z.number(), z.string()]),
  isDeleted: z.boolean(),
  deletedAt: z.string().nullable().optional(),
}).passthrough();

const orderDetailsPascalSchema = z.object({
  Id: z.number().int(),
  OrderNumber: z.string(),
  Place: z.string(),
  InspectionPlace: z.string(),
  OrderDate: z.string(),
  Latitude: z.number().nullable().optional(),
  Longitude: z.number().nullable().optional(),
  PlotId: z.number().nullable().optional(),
  PlotName: z.string().nullable().optional(),

  DeceasedFullName: z.string(),
  CustomerFullName: z.string(),
  CustomerEmail: z.string().nullable().optional(),
  Phone: z.string(),
  Address: z.string(),

  monumentType: z.string().optional().nullable(),
  monumentSize: z.string().optional().nullable(),
  additionalInfo: z.string().optional().nullable(),

  Status: z.union([z.number(), z.string()]),

  Subtotal: z.number(),
  DiscountPercent: z.number(),
  DiscountAmount: z.number(),
  TotalPrice: z.number(),

  CreatedAt: z.string(),
  UpdatedAt: z.string(),

  ManagerId: z.number().int(),
  ManagerFullName: z.string(),

  WorkItems: z.array(workItemSchema),
  Payments: z.array(paymentSchema),
  Photos: z.array(mediaSchema),

  Completion: orderCompletionSchema.nullable().optional(),

  PaymentStatus: z.union([z.number(), z.string()]),
  IsDeleted: z.boolean(),
  DeletedAt: z.string().nullable().optional(),
}).passthrough().transform((v) => ({
  id: v.Id,
  orderNumber: v.OrderNumber,
  place: v.Place,
  inspectionPlace: v.InspectionPlace,
  orderDate: v.OrderDate,
  latitude: v.Latitude,
  longitude: v.Longitude,
  plotId: v.PlotId,
  plotName: v.PlotName,
  deceasedFullName: v.DeceasedFullName,
  customerFullName: v.CustomerFullName,
  customerEmail: v.CustomerEmail,
  phone: v.Phone,
  address: v.Address,
  monumentType: v.MonumentType,
  monumentSize: v.MonumentSize,
  additionalInfo: v.AdditionalInfo,
  status: v.Status,

  subtotal: v.Subtotal,
  discountPercent: v.DiscountPercent,
  discountAmount: v.DiscountAmount,
  totalPrice: v.TotalPrice,

  createdAt: v.CreatedAt,
  updatedAt: v.UpdatedAt,
  managerId: v.ManagerId,
  managerFullName: v.ManagerFullName,
  workItems: v.WorkItems,
  payments: v.Payments,
  photos: v.Photos,

  completion: v.Completion,

  paymentStatus: v.PaymentStatus,
  isDeleted: v.IsDeleted,
  deletedAt: v.DeletedAt,
}));

export const orderDetailsSchema = z.union([
  orderDetailsCamelSchema,
  orderDetailsPascalSchema,
]);

export const OrderStatus = {
  InProgress: 1,
  AwaitingConfirmation: 5,
  Completed: 6,
  RevisionRequired: 7,
} as const

export type OrderStatus =
  (typeof OrderStatus)[keyof typeof OrderStatus]

export type OrderDetailsDto = z.infer<typeof orderDetailsSchema>;

export interface SubmitForReviewRequest {
  tempMediaIds: number[]
  note?: string
}

export interface SubmitForReviewResponse {
  success: boolean
  message: string
  notificationId: number
  newStatus: number
}