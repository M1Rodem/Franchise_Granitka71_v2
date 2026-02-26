import { z } from 'zod';

const orderCamelSchema = z
  .object({
    id: z.number().int(),
    orderNumber: z.string(),
    customerFullName: z.string(),
    createdAt: z.string(),
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
    CreatedAt: z.string(),
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
    createdAt: value.CreatedAt,
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
