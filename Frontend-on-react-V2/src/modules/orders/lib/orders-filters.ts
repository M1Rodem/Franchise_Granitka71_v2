import type { OrdersFiltersNormalized, OrdersListQueryParams } from '@/modules/orders/types/orders.types';

export const DEFAULT_ORDERS_PAGE = 1;
export const DEFAULT_ORDERS_PAGE_SIZE = 20;

const normalizeText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeOrdersListParams = (params: OrdersListQueryParams): OrdersFiltersNormalized => ({
  searchQuery: normalizeText(params.searchQuery),
  dateFrom: normalizeText(params.dateFrom),
  dateTo: normalizeText(params.dateTo),
  plotId: params.plotId ?? undefined,
  paymentStatus: params.paymentStatus ?? undefined,
  completionStatus: params.completionStatus ?? undefined,
  page: Math.max(DEFAULT_ORDERS_PAGE, params.page),
  pageSize: Math.max(1, params.pageSize),
});