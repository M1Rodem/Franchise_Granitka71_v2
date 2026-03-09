import { useQuery } from '@tanstack/react-query'
import { plotsApi } from '../api/plots.api'
import type { PlotDto } from '../types/plots.types'

export function usePlots() {
  return useQuery<PlotDto[]>({
    queryKey: ['plots', 'all'],
    queryFn: () => plotsApi.getAllPlots(),
  })
}