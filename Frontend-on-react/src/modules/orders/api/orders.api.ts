import { httpClient } from '@/shared/api/http-client';
import {
  ordersPagedResultSchema,
  type OrdersListQueryParams,
  type OrdersPagedResultDto,
} from '@/modules/orders/types/orders.types';
import { normalizeOrdersListParams } from '@/modules/orders/lib/orders-filters';

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
};