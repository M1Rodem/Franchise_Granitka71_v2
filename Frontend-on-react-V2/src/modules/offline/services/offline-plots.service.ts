import { plotsApi } from '@/modules/plots/api/plots.api'
import { offlinePlotsStore } from '@/modules/offline/storage/offline-plots.store'
import { tilePrecacheService } from '@/modules/pwa/services/tilePrecache.service'
import type { CachedPlot, SyncPlotsResult } from '@/modules/offline/types/offline-plots.types'
import type { PlotDto } from '@/modules/plots/types/plots.types'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const offlinePlotsService = {
  async syncPlots(retryCount: number = 0): Promise<SyncPlotsResult> {
    try {     
      const plots = await plotsApi.getAllPlots()

      const cachedPlots: CachedPlot[] = plots.map((plot: PlotDto) => ({
        id: plot.id,
        name: plot.name,
        description: plot.description ?? null,
        latitude: plot.latitude,
        longitude: plot.longitude,
        isActive: plot.isActive ?? true,
        createdAt: plot.createdAt,
        updatedAt: plot.updatedAt,
        lastSyncedAt: new Date().toISOString(),
      }))

      const existingPlots = await offlinePlotsStore.getAllPlots()
      const existingMap = new Map(existingPlots.map((p) => [p.id, p]))

      let added = 0
      let updated = 0

      for (const newPlot of cachedPlots) {
        const existing = existingMap.get(newPlot.id)

        if (!existing) {
          added++
        } else if (
          existing.name !== newPlot.name ||
          existing.latitude !== newPlot.latitude ||
          existing.longitude !== newPlot.longitude ||
          existing.isActive !== newPlot.isActive
        ) {
          updated++
        }
      }

      // Сохраняем участки в IndexedDB
      await offlinePlotsStore.savePlots(cachedPlots)
      
      // ===== НОВОЕ: Запускаем кеширование тайлов для участков =====
      // Запускаем асинхронно, не блокируя основной поток
      // Используем активные участки для кеширования
      const activePlots = cachedPlots.filter(p => p.isActive !== false)
      
      if (activePlots.length > 0) {
        // Проверяем, не закешировано ли уже
        if (!tilePrecacheService.isPrecached()) {          
          // Запускаем без await, чтобы не блокировать синхронизацию
          tilePrecacheService.precachePlots(
            activePlots,
            (loaded, total) => {
              // Обновляем прогресс в localStorage для компонента
              localStorage.setItem('tile_precache_loaded', String(loaded))
              localStorage.setItem('tile_precache_total', String(total))
              localStorage.setItem('tile_precache_active', 'true')
            },
            () => {
              localStorage.setItem('tile_precache_active', 'false')
              localStorage.setItem('tile_precache_complete', 'true')
            },
            (error) => {
              console.error('[TilePrecache] Ошибка:', error)
              localStorage.setItem('tile_precache_active', 'false')
            }
          )
        } else {
        }
      } else {
      }
      
      return {
        added,
        updated,
        total: cachedPlots.length,
      }
    } catch (error) {
      console.error(`[SyncPlots] Error (attempt ${retryCount + 1}):`, error)
      
      if (retryCount < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS)
        return this.syncPlots(retryCount + 1)
      }
      
      throw error
    }
  },

  async getCachedPlots(): Promise<CachedPlot[]> {
    const allPlots = await offlinePlotsStore.getAllPlots()
    return allPlots
  },

  async hasPlots(): Promise<boolean> {
    const count = await offlinePlotsStore.count()
    return count > 0
  },
}