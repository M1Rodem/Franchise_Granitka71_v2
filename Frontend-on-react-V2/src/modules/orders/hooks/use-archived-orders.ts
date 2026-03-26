import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ordersApi } from '@/modules/orders/api/orders.api'
import { ordersKeys } from '@/modules/orders/lib/orders.keys'
import type { OrdersListQueryParams } from '@/modules/orders/types/orders.types'

export function useArchivedOrders(params: OrdersListQueryParams) {
  return useQuery({
    queryKey: ordersKeys.archived(params),
    queryFn: () => ordersApi.getArchivedOrders(params),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}