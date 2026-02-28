import type { OrdersListQueryParams } from '@/modules/orders/types/orders.types';
import { normalizeOrdersListParams } from '@/modules/orders/lib/orders-filters';

export const ordersKeys = {
  all: ['orders'] as const,
  list: (params: OrdersListQueryParams) =>
    [...ordersKeys.all, 'list', normalizeOrdersListParams(params)] as const,
  byId: (id: number) =>
  [...ordersKeys.all, 'byId', id] as const,
};