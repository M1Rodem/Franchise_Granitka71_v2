import { env } from '@/shared/config/env'
import { offlinePlotsStore } from '@/modules/offline/storage/offline-plots.store'
import type { CachedPlot } from '@/modules/offline/types/offline-plots.types'

const YANDEX_TILE_URL = 'https://core-renderer-tiles.maps.yandex.net/tiles'

// Новый ключ для версионирования кеша участков
const PRECACHE_PLOTS_KEY = 'tiles_precached_plots_v1'

// Функция для конвертации lat/lng в X/Y тайла
function deg2num(lat: number, lng: number, zoom: number) {
  const latRad = lat * Math.PI / 180
  const n = Math.pow(2, zoom)
  let x = Math.floor((lng + 180) / 360 * n)
  let y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

// Получить тайлы вокруг точки с заданным радиусом
function getTilesAroundPoint(
  lat: number,
  lng: number,
  zoom: number,
  radiusInTiles: number = 2
): Array<{ x: number, y: number, url: string }> {
  const { x, y } = deg2num(lat, lng, zoom)
  const tiles: Array<{ x: number, y: number, url: string }> = []
  
  for (let dx = -radiusInTiles; dx <= radiusInTiles; dx++) {
    for (let dy = -radiusInTiles; dy <= radiusInTiles; dy++) {
      const tileX = x + dx
      const tileY = y + dy
      
      // Проверяем валидность координат тайла
      if (tileX < 0 || tileY < 0 || tileX >= Math.pow(2, zoom) || tileY >= Math.pow(2, zoom)) {
        continue
      }
      
      const url = `${YANDEX_TILE_URL}?l=map&x=${tileX}&y=${tileY}&z=${zoom}&scale=1&lang=ru_RU&apikey=${env.yandexMapApiKey}&ads=enabled`
      tiles.push({ x: tileX, y: tileY, url })
    }
  }
  
  return tiles
}

// Получить уникальные тайлы для всех участков
function getUniqueTilesForPlots(
  plots: CachedPlot[],
  radiusInTiles: number = 2,
  zooms: number[] = [14, 15]
): string[] {
  const urlSet = new Set<string>()
  
  for (const plot of plots) {
    // Пропускаем неактивные участки
    if (!plot.isActive) continue
    
    // Пропускаем участки без координат
    if (!plot.latitude || !plot.longitude) continue
    
    for (const zoom of zooms) {
      const tiles = getTilesAroundPoint(plot.latitude, plot.longitude, zoom, radiusInTiles)
      for (const tile of tiles) {
        urlSet.add(tile.url)
      }
    }
  }
  
  return Array.from(urlSet)
}

// Хранилище для прогресса
class TilePrecacheService {
  private isPrecaching = false
  private totalTiles = 0
  private loadedTiles = 0
  private onProgressCallback?: (loaded: number, total: number, zoom?: number) => void
  private onCompleteCallback?: () => void
  private onErrorCallback?: (error: Error) => void

  async precachePlots(
    plots?: CachedPlot[],
    onProgress?: (loaded: number, total: number) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ) {
    // Проверяем, не закешировано ли уже (по версии)
    const precached = localStorage.getItem(PRECACHE_PLOTS_KEY)
    if (precached === 'true') {
      onComplete?.()
      return
    }

    if (this.isPrecaching) {
      return
    }

    this.isPrecaching = true
    this.onProgressCallback = onProgress
    this.onCompleteCallback = onComplete
    this.onErrorCallback = onError
    this.loadedTiles = 0

    try {
      // Если участки не переданы, загружаем из хранилища
      const cachedPlots = plots || await offlinePlotsStore.getActivePlots()
      
      if (cachedPlots.length === 0) {
        console.warn('[TilePrecache] Нет участков для кеширования')
        this.isPrecaching = false
        onComplete?.()
        return
      }

      // Получаем все уникальные тайлы для участков
      const allTiles = getUniqueTilesForPlots(cachedPlots, 2, [14, 15])
      this.totalTiles = allTiles.length

      if (this.totalTiles === 0) {
        console.warn('[TilePrecache] Нет тайлов для кеширования')
        this.isPrecaching = false
        onComplete?.()
        return
      }

      console.log(`[TilePrecache] Начинаем кеширование ${this.totalTiles} тайлов для ${cachedPlots.length} участков`)

      // Загружаем тайлы чанками по 10 штук (меньше нагрузка на сеть)
      const chunkSize = 10
      let loadedCount = 0
      
      for (let i = 0; i < allTiles.length; i += chunkSize) {
        const chunk = allTiles.slice(i, i + chunkSize)
        
        await Promise.all(chunk.map(async (url) => {
          try {
            const cache = await caches.open('yandex-maps-tiles')
            const cachedResponse = await cache.match(url)
            
            if (cachedResponse) {
              loadedCount++
              this.loadedTiles = loadedCount
              this.onProgressCallback?.(this.loadedTiles, this.totalTiles)
              return
            }

            const response = await fetch(url, {
              mode: 'cors',
              credentials: 'omit'
            })
            
            if (response.ok) {
              await cache.put(url, response)
            } else {
              console.warn(`[TilePrecache] Failed to load tile: ${url}, status: ${response.status}`)
            }
          } catch (e) {
            console.error(`[TilePrecache] Error loading tile: ${url}`, e)
          } finally {
            loadedCount++
            this.loadedTiles = Math.min(loadedCount, this.totalTiles)
            this.onProgressCallback?.(this.loadedTiles, this.totalTiles)
          }
        }))
        
        // Небольшая задержка между чанками для снижения нагрузки
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // ===== НОВОЕ: КЕШИРУЕМ API СКРИПТ =====
      await this.cacheYandexApi()

      // Сохраняем отметку о завершении
      localStorage.setItem(PRECACHE_PLOTS_KEY, 'true')
      this.isPrecaching = false
      this.onCompleteCallback?.()
      
      console.log(`[TilePrecache] Кеширование завершено. Загружено ${this.loadedTiles} из ${this.totalTiles} тайлов + API`)
    } catch (error) {
      this.isPrecaching = false
      const err = error instanceof Error ? error : new Error('Ошибка кеширования тайлов')
      this.onErrorCallback?.(err)
      console.error('[TilePrecache] Ошибка:', err)
    }
  }

  // ===== НОВЫЙ МЕТОД: Кеширование API скрипта =====
  private async cacheYandexApi() {
    const API_URL = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU`
    
    try {
      console.log('[TilePrecache] Кешируем API скрипт...')
      const apiCache = await caches.open('yandex-maps-api')
      const cachedApi = await apiCache.match(API_URL)
      
      if (!cachedApi) {
        const response = await fetch(API_URL, {
          mode: 'cors',
          credentials: 'omit'
        })
        
        if (response.ok) {
          await apiCache.put(API_URL, response)
          console.log('[TilePrecache] API скрипт закеширован')
        } else {
          console.warn('[TilePrecache] Не удалось закешировать API:', response.status)
        }
      } else {
        console.log('[TilePrecache] API скрипт уже в кеше')
      }
    } catch (e) {
      console.error('[TilePrecache] Ошибка кеширования API:', e)
    }
  }

  async getPrecacheStatus(): Promise<{
    isCached: boolean
    tileCount: number
    totalSizeMB: string
  }> {
    const isCached = this.isPrecached()
    const stats = await this.getCacheStats()
    
    return {
      isCached,
      tileCount: stats?.tileCount || 0,
      totalSizeMB: stats?.totalSizeMB || '0',
    }
  }

  getProgress() {
    return { 
      loaded: this.loadedTiles, 
      total: this.totalTiles, 
      isActive: this.isPrecaching 
    }
  }

  isPrecached(): boolean {
    return localStorage.getItem(PRECACHE_PLOTS_KEY) === 'true'
  }

  // Очистка кеша тайлов (для отладки или принудительного обновления)
  async clearCache() {
    try {
      const tileCache = await caches.open('yandex-maps-tiles')
      const tileKeys = await tileCache.keys()
      for (const key of tileKeys) {
        await tileCache.delete(key)
      }
      
      const apiCache = await caches.open('yandex-maps-api')
      const apiKeys = await apiCache.keys()
      for (const key of apiKeys) {
        await apiCache.delete(key)
      }
      
      localStorage.removeItem(PRECACHE_PLOTS_KEY)
      console.log('[TilePrecache] Кеш очищен')
    } catch (error) {
      console.error('[TilePrecache] Ошибка очистки кеша:', error)
    }
  }

  // Получить статистику кеша
  async getCacheStats() {
    try {
      const cache = await caches.open('yandex-maps-tiles')
      const keys = await cache.keys()
      let totalSize = 0
      
      for (const request of keys) {
        const response = await cache.match(request)
        if (response) {
          const blob = await response.blob()
          totalSize += blob.size
        }
      }
      
      return {
        tileCount: keys.length,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        isPrecached: this.isPrecached()
      }
    } catch (error) {
      console.error('[TilePrecache] Ошибка получения статистики:', error)
      return null
    }
  }
}

export const tilePrecacheService = new TilePrecacheService()