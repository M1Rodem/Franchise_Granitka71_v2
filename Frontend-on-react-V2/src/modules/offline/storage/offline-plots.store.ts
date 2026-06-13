import { OFFLINE_STORE_NAMES } from '@/modules/offline/storage/offline-db.types'
import { withStore, wrapRequest } from '@/modules/offline/storage/offline-db'
import type { CachedPlot } from '@/modules/offline/types/offline-plots.types'

export const offlinePlotsStore = {
  async savePlot(plot: CachedPlot) {
    await withStore(OFFLINE_STORE_NAMES.plots, 'readwrite', async (store) => {
      await wrapRequest(store.put(plot))
    })
  },

  async savePlots(plots: CachedPlot[]) {
    await withStore(OFFLINE_STORE_NAMES.plots, 'readwrite', async (store) => {
      for (const plot of plots) {
        await wrapRequest(store.put(plot))
      }
    })
  },

  async getAllPlots(): Promise<CachedPlot[]> {
    return withStore(OFFLINE_STORE_NAMES.plots, 'readonly', async (store) => {
      return wrapRequest<CachedPlot[]>(store.getAll())
    })
  },

  async getPlot(id: number): Promise<CachedPlot | undefined> {
    return withStore(OFFLINE_STORE_NAMES.plots, 'readonly', async (store) => {
      return wrapRequest<CachedPlot | undefined>(store.get(id))
    })
  },

  async getActivePlots(): Promise<CachedPlot[]> {
    return withStore(OFFLINE_STORE_NAMES.plots, 'readonly', async (store) => {
      // Сначала пробуем получить активные
      try {
        const index = store.index('isActive')
        const range = IDBKeyRange.only(true)
        const activePlots = await wrapRequest<CachedPlot[]>(index.getAll(range))
        if (activePlots.length > 0) {
          return activePlots
        }
      } catch (e) {
        console.log('Index isActive not found, getting all plots')
      }
      // Если нет индекса или нет активных - возвращаем все
      return wrapRequest<CachedPlot[]>(store.getAll())
    })
  },

  async clearAll() {
    await withStore(OFFLINE_STORE_NAMES.plots, 'readwrite', async (store) => {
      await wrapRequest(store.clear())
    })
  },

  async count(): Promise<number> {
    return withStore(OFFLINE_STORE_NAMES.plots, 'readonly', async (store) => {
      return wrapRequest<number>(store.count())
    })
  },
}