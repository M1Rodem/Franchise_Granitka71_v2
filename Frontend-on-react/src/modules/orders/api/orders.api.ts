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

  totalPrice: number;

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

  totalPrice?: number

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

    const response = await httpClient.get('/api/orders', {
      params: {
        SearchQuery: normalized.searchQuery,
        CreatedFrom: normalized.dateFrom,
        CreatedTo: normalized.dateTo,
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
    return orderDetailsSchema.parse(response.data);
  },

  async createOrder(payload: CreateOrderRequestDto): Promise<OrderDetailsDto> {
    const response = await httpClient.post('/api/orders', payload);
    return orderDetailsSchema.parse(response.data);
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
  }
};