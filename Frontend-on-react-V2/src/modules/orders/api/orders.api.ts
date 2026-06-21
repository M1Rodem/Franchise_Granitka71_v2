import { httpClient } from '@/shared/api/http-client';
import {
  ordersPagedResultSchema,
  type OrdersListQueryParams,
  type OrdersPagedResultDto,
  orderDetailsSchema,
  type OrderDetailsDto,
} from '@/modules/orders/types/orders.types';
import { normalizeOrdersListParams } from '@/modules/orders/lib/orders-filters';
import type {
  SubmitForReviewRequest,
  SubmitForReviewResponse,
} from '@/modules/orders/types/orders.types'

export interface OrderUpdateRequestResponse {
  success: boolean;
  message: string;
  notificationId: number;
}

export type UpdateOrderResponse = OrderDetailsDto | OrderUpdateRequestResponse;

export interface CreateOrderRequestDto {
  place: string;
  inspectionPlace: string;
  orderDate: string;
  latitude: number | null;
  longitude: number | null;
  plotId: number | null;

  deceasedFullName: string;
  customerFullName: string;
  customerEmail?: string | null;
  phone: string;
  address: string;

  monumentType?: string;
  monumentSize?: string;
  additionalInfo?: string;

  discountPercent: number;

  workItems: {
    id?: number;
    workDescription: string;
    price: number;
    quantity?: number;
    routes?: number;
    distanceKm?: number;
    isDistanceWork?: boolean;
    note?: string;
  }[];

  payments: {
    id?: number;
    amount: number;
    paymentDate: string;
    paymentType: string;
    note?: string;
  }[];

  tempPhotoIds: number[];
  tempVideoIds: number[];
  
  ownerUserId?: number;
}

export interface UpdateOrderRequestDto {
  place?: string
  inspectionPlace?: string
  orderDate?: string
  latitude?: number | null
  longitude?: number | null
  plotId?: number | null

  deceasedFullName?: string

  customerFullName?: string
  customerEmail?: string | null
  phone?: string
  address?: string

  monumentType?: string
  monumentSize?: string
  additionalInfo?: string

  discountPercent?: number

  workItems?: {
    id?: number;

    workDescription: string;
    price: number;

    quantity?: number;

    routes?: number;
    distanceKm?: number;

    isDistanceWork?: boolean;

    note?: string;
  }[]

  payments?: {
    id?: number
    amount: number
    paymentDate: string
    paymentType: string
    note?: string
  }[]

  tempPhotoIds?: number[]
  tempVideoIds?: number[]

  removedPhotoIds?: number[]
  removedVideoIds?: number[]
}

export const ordersApi = {
  async getOrders(params: OrdersListQueryParams): Promise<OrdersPagedResultDto> {
    const normalized = normalizeOrdersListParams(params);

    const response = await httpClient.get('/orders/list', {
      params: {
        SearchQuery: normalized.searchQuery,
        OrderDateFrom: normalized.dateFrom,
        OrderDateTo: normalized.dateTo,
        PlotId: normalized.plotId,
        PaymentStatus: normalized.paymentStatus,
        Status: normalized.completionStatus,
        Page: normalized.page,
        PageSize: normalized.pageSize,
      },
    });

    return ordersPagedResultSchema.parse(response.data);
  },

  async submitForReview(
    id: number,
    payload: SubmitForReviewRequest
  ): Promise<SubmitForReviewResponse> {
    const response = await httpClient.post(
      `/orders/${id}/submit-for-review`,
      payload
    )

    return response.data
  },

  async printOrderHtml(id: number, type: 'default' | 'worker' = 'default'): Promise<Blob> {
    const response = await httpClient.get(`/Print/order/${id}/html-print`, {
      params: { type },
      responseType: 'blob',
    })

    return response.data
  },

  async downloadOrderExcel(id: number, type: 'default' | 'worker' = 'default'): Promise<Blob> {
    const response = await httpClient.get(`/Print/order/${id}/download`, {
      params: { type },
      responseType: 'blob',
    })

    return response.data
  },

  async printOrderWithPhotos(id: number, type: 'default' | 'worker', photoIds: number[]): Promise<Blob> {
    const photoIdsParam = photoIds.join(',');
    const response = await httpClient.get(`/Print/order/${id}/download`, {
      params: { type, photoIds: photoIdsParam },
      responseType: 'blob',
    });
    return response.data;
  },

  async getById(id: number): Promise<OrderDetailsDto> {
    const response = await httpClient.get(`/orders/${id}`);
    const parsed = orderDetailsSchema.safeParse(response.data);

    if (!parsed.success) {
      console.error('OrderDetails parse error:', parsed.error);
      throw new Error('DTO parse error');
    }

    return parsed.data;
  },

  async createOrder(payload: CreateOrderRequestDto): Promise<OrderDetailsDto> {
    const response = await httpClient.post('/orders', payload);
    const parsed = orderDetailsSchema.safeParse(response.data);

    if (!parsed.success) {
      console.error('OrderDetails parse error:', parsed.error);
      throw new Error('DTO parse error');
    }

    return parsed.data;
  },

  async deleteOrder(id: number): Promise<void> {
    await httpClient.delete(`/orders/${id}`);
  },

  async updateOrder(
    id: number,
    payload: UpdateOrderRequestDto
  ): Promise<UpdateOrderResponse> {
    const response = await httpClient.put(`/orders/${id}`, payload)

    // Возвращаем как есть, разбор будет в provider
    return response.data
  },

  // =========================
  // ARCHIVED ORDERS
  // =========================

  async getArchivedOrders(params: OrdersListQueryParams): Promise<OrdersPagedResultDto> {
    const normalized = normalizeOrdersListParams(params);

    const response = await httpClient.get('/orders/archived/list', {
      params: {
        SearchQuery: normalized.searchQuery,
        OrderDateFrom: normalized.dateFrom,
        OrderDateTo: normalized.dateTo,
        PlotId: normalized.plotId,
        PaymentStatus: normalized.paymentStatus,
        Status: normalized.completionStatus,
        Page: normalized.page,
        PageSize: normalized.pageSize,
      },
    });

    return ordersPagedResultSchema.parse(response.data);
  },

  async getArchivedById(id: number): Promise<OrderDetailsDto> {
    const response = await httpClient.get(`/orders/archived/${id}`);

    const parsed = orderDetailsSchema.safeParse(response.data);

    if (!parsed.success) {
      console.error('Archived order parse error:', parsed.error);
      throw new Error('DTO parse error');
    }

    return parsed.data;
  },

  async restoreOrder(id: number): Promise<void> {
    await httpClient.post(`/orders/${id}/restore`);
  },

  async deleteArchivedOrder(id: number): Promise<void> {
    return httpClient.delete(`/orders/archived/${id}`);
  },
};