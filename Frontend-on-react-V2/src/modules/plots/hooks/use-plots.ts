import { useQuery } from '@tanstack/react-query'
import { plotsApi } from '../api/plots.api'
import { offlinePlotsService } from '@/modules/offline/services/offline-plots.service'
import { connectivityService } from '@/modules/offline/services/connectivity.service'
import type { PlotDto } from '../types/plots.types'
import type { CachedPlot } from '@/modules/offline/types/offline-plots.types'

function mapCachedToPlotDto(cached: CachedPlot): PlotDto {
  return {
    id: cached.id,
    name: cached.name,
    description: cached.description,
    latitude: cached.latitude,
    longitude: cached.longitude,
    isActive: cached.isActive,
    createdAt: cached.createdAt,
    updatedAt: cached.updatedAt,
  }
}

export function usePlots() {
  const isOnline = connectivityService.isOnline()

  return useQuery<PlotDto[]>({
    queryKey: ['plots', 'all'],
    queryFn: async () => {
      console.log('[usePlots] queryFn called, isOnline:', isOnline)
      
      // Принудительно при оффлайн - берем из кеша
      if (!isOnline || !navigator.onLine) {
        console.log('[usePlots] OFFLINE - fetching from cache')
        const cachedPlots = await offlinePlotsService.getCachedPlots()
        if (cachedPlots.length === 0) {
          console.log('[usePlots] No cached plots found')
          return []
        }
        return cachedPlots.map(mapCachedToPlotDto)
      }
      
      console.log('[usePlots] ONLINE - fetching from API')
      const plots = await plotsApi.getAllPlots()
      return plots
    },
    staleTime: 0, // Не кешировать данные между сессиями
    gcTime: 0, // Сразу удалять из кеша
    networkMode: 'always',
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
  })
}