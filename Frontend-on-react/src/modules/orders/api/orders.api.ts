import { httpClient } from '@/shared/api/http-client';
import {
  ordersPagedResultSchema,
  type OrdersListQueryParams,
  type OrdersPagedResultDto,
  orderDetailsSchema,
  type OrderDetailsDto,
} from '@/modules/orders/types/orders.types';
import { normalizeOrdersListParams } from '@/modules/orders/lib/orders-filters';

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
    workDescription: string;
    price: number;
    quantity: number;
    note?: string;
  }[];

  payments: {
    amount: number;
    paymentDate: string;
    paymentType: string;
    note?: string;
  }[];

  tempPhotoIds: number[];
  tempVideoIds: number[];
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
    workDescription: string
    price: number
    quantity: number
    note?: string
  }[]

  payments?: {
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

    const response = await httpClient.get('/api/orders/list', {
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

  async getById(id: number): Promise<OrderDetailsDto> {
    const response = await httpClient.get(`/api/orders/${id}`);
    const parsed = orderDetailsSchema.safeParse(response.data);

    if (!parsed.success) {
      console.error('OrderDetails parse error:', parsed.error);
      throw new Error('DTO parse error');
    }

    return parsed.data;
  },

  async createOrder(payload: CreateOrderRequestDto): Promise<OrderDetailsDto> {
    const response = await httpClient.post('/api/orders', payload);
    const parsed = orderDetailsSchema.safeParse(response.data);

    if (!parsed.success) {
      console.error('OrderDetails parse error:', parsed.error);
      throw new Error('DTO parse error');
    }

    return parsed.data;
  },

  async deleteOrder(id: number): Promise<void> {
    await httpClient.delete(`/api/orders/${id}`);
  },

  async updateOrder(
    id: number,
    payload: UpdateOrderRequestDto
  ): Promise<OrderDetailsDto> {
    const response = await httpClient.put(`/api/orders/${id}`, payload)
    return orderDetailsSchema.parse(response.data)
  },
  
  // =========================
  // ARCHIVED ORDERS
  // =========================

  async getArchivedOrders(params: OrdersListQueryParams): Promise<OrdersPagedResultDto> {
    const normalized = normalizeOrdersListParams(params);

    const response = await httpClient.get('/api/orders/archived/list', {
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
    const response = await httpClient.get(`/api/orders/archived/${id}`);

    const parsed = orderDetailsSchema.safeParse(response.data);

    if (!parsed.success) {
      console.error('Archived order parse error:', parsed.error);
      throw new Error('DTO parse error');
    }

    return parsed.data;
  },

  async restoreOrder(id: number): Promise<void> {
    await httpClient.post(`/api/orders/${id}/restore`);
  },

  async deleteArchivedOrder(id: number): Promise<void> {
    await httpClient.delete(`/api/orders/archived/${id}`);
  },
};