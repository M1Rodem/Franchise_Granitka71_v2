import { useQuery } from '@tanstack/react-query'
import { httpClient } from '@/shared/api/http-client'

type CheckBlockingResponse = {
  isBlocked: boolean
  blockingCount: number
  message: string | null
  timestamp: string
}

async function fetchBlocking(): Promise<CheckBlockingResponse> {
  const { data } = await httpClient.get('/notifications/check-blocking')
  return data
}

export function useOrderBlocking() {
  const query = useQuery({
    queryKey: ['notifications', 'blocking'],
    queryFn: fetchBlocking,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  })


  return {
    isBlocked: query.data?.isBlocked ?? false,
    blockingCount: query.data?.blockingCount ?? 0,
    message: query.data?.message ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}
