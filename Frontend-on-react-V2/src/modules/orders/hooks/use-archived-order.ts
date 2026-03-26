import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '@/modules/orders/api/orders.api'
import { ordersKeys } from '@/modules/orders/lib/orders.keys'

export function useArchivedOrder(id: number) {
  return useQuery({
    queryKey: ordersKeys.archivedById(id),
    queryFn: () => ordersApi.getArchivedById(id),
    enabled: !!id,
  })
}