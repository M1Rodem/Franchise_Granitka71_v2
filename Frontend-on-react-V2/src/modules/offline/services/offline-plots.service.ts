import { plotsApi } from '@/modules/plots/api/plots.api'
import { offlinePlotsStore } from '@/modules/offline/storage/offline-plots.store'
import type { CachedPlot, SyncPlotsResult } from '@/modules/offline/types/offline-plots.types'
import type { PlotDto } from '@/modules/plots/types/plots.types'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const offlinePlotsService = {
  async syncPlots(retryCount: number = 0): Promise<SyncPlotsResult> {
    try {
      console.log(`[SyncPlots] Attempt ${retryCount + 1}/${MAX_RETRIES + 1}`)
      
      const plots = await plotsApi.getAllPlots()
      console.log(`[SyncPlots] Fetched ${plots.length} plots from API`)

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

      await offlinePlotsStore.savePlots(cachedPlots)
      
      const savedCount = await offlinePlotsStore.count()
      console.log(`[SyncPlots] Saved ${savedCount} plots to IndexedDB`)

      return {
        added,
        updated,
        total: cachedPlots.length,
      }
    } catch (error) {
      console.error(`[SyncPlots] Error (attempt ${retryCount + 1}):`, error)
      
      if (retryCount < MAX_RETRIES) {
        console.log(`[SyncPlots] Retrying in ${RETRY_DELAY_MS}ms...`)
        await delay(RETRY_DELAY_MS)
        return this.syncPlots(retryCount + 1)
      }
      
      throw error
    }
  },

  async getCachedPlots(): Promise<CachedPlot[]> {
    const allPlots = await offlinePlotsStore.getAllPlots()
    console.log('[offlinePlotsService] getAllPlots returned:', allPlots.length)
    return allPlots
  },

  async hasPlots(): Promise<boolean> {
    const count = await offlinePlotsStore.count()
    return count > 0
  },
}