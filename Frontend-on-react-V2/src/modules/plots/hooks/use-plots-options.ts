import { useQuery } from '@tanstack/react-query'
import { plotsApi } from '../api/plots.api'
import type { PlotDto } from '../types/plots.types'

type PlotsPage = {
  items: PlotDto[]
  total: number
}

export function usePlotsPage(page: number, search?: string) {
  const pageSize = 10

  return useQuery<PlotsPage>({
    queryKey: ['plots', 'page', page, search],
    queryFn: () => plotsApi.getPlots(page, pageSize, search),
    placeholderData: (prev) => prev,
  })
}