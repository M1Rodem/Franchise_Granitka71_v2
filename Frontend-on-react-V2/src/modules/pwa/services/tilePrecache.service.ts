import { env } from '@/shared/config/env'

// Координаты Тульской области (расширенные)
const TULA_BOUNDS = {
  north: 54.6,  // север области (за Алексиным)
  south: 53.6,  // юг области (Ефремов)
  west: 36.5,   // запад (Белев)
  east: 38.8    // восток (Новомосковск)
}

// Уровни зума для кеширования (10-14 достаточно для навигации)
const ZOOM_LEVELS = [11, 12, 13, 14]

const YANDEX_TILE_URL = 'https://core-renderer-tiles.maps.yandex.net/tiles'

const YANDEX_API_URL = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU`

// Функция для конвертации lat/lng в X/Y тайла
function deg2num(lat: number, lng: number, zoom: number) {
  const latRad = lat * Math.PI / 180
  const n = Math.pow(2, zoom)
  let x = Math.floor((lng + 180) / 360 * n)
  let y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

// Получить все тайлы для заданной области и зума
function getAllTilesForZoom(
  north: number, south: number, west: number, east: number, zoom: number
): Array<{ x: number, y: number, url: string }> {
  const topLeft = deg2num(north, west, zoom)
  const bottomRight = deg2num(south, east, zoom)
  
  const tiles: Array<{ x: number, y: number, url: string }> = []
  
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      const url = `${YANDEX_TILE_URL}?l=map&x=${x}&y=${y}&z=${zoom}&scale=1&lang=ru_RU`
      tiles.push({ x, y, url })
    }
  }
  
  return tiles
}

// Собрать все тайлы для всех зумов
function getAllTiles(): string[] {
  const allTiles: string[] = []
  
  for (const zoom of ZOOM_LEVELS) {
    const tiles = getAllTilesForZoom(
      TULA_BOUNDS.north, TULA_BOUNDS.south,
      TULA_BOUNDS.west, TULA_BOUNDS.east,
      zoom
    )
    console.log(`[TilePrecache] Zoom ${zoom}: ${tiles.length} тайлов`)
    allTiles.push(...tiles.map(t => t.url))
  }
  
  return allTiles
}

// Хранилище для прогресса
const PRECACHE_KEY = 'tiles_precached'
const PRECACHE_VERSION = 'v2'

class TilePrecacheService {
  private isPrecaching = false
  private totalTiles = 0
  private loadedTiles = 0
  private onProgressCallback?: (loaded: number, total: number, zoom?: number) => void
  private onCompleteCallback?: () => void

  async startPrecache(
    onProgress?: (loaded: number, total: number, zoom?: number) => void,
    onComplete?: () => void
  ) {
    // Проверяем, не закешировано ли уже
    const precached = localStorage.getItem(PRECACHE_KEY)
    if (precached === PRECACHE_VERSION) {
      console.log('[TilePrecache] Тайлы уже закешированы')
      onComplete?.()
      return
    }

    if (this.isPrecaching) {
      console.log('[TilePrecache] Уже в процессе загрузки')
      return
    }

    this.isPrecaching = true
    this.onProgressCallback = onProgress
    this.onCompleteCallback = onComplete
    this.loadedTiles = 0

    const allTiles = getAllTiles()
    this.totalTiles = allTiles.length

    console.log(`[TilePrecache] Начинаем загрузку ${this.totalTiles} тайлов для Тульской области`)

    // Загружаем тайлы чанками по 20 штук
    const chunkSize = 20
    
    for (let i = 0; i < allTiles.length; i += chunkSize) {
      const chunk = allTiles.slice(i, i + chunkSize)
      
      await Promise.all(chunk.map(async (url) => {
        try {
          const cache = await caches.open('yandex-maps-tiles')
          const cachedResponse = await cache.match(url)
          
          if (cachedResponse) {
            this.loadedTiles++
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
          this.loadedTiles = Math.min(this.loadedTiles + 1, this.totalTiles)
          this.onProgressCallback?.(this.loadedTiles, this.totalTiles)
        }
      }))
      
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Кешируем Yandex Maps API
    try {
      console.log('[TilePrecache] Кешируем Yandex Maps API...')
      const apiCache = await caches.open('yandex-maps-api')
      const apiResponse = await fetch(YANDEX_API_URL)
      if (apiResponse.ok) {
        await apiCache.put(YANDEX_API_URL, apiResponse)
        console.log('[TilePrecache] Yandex Maps API cached')
      } else {
        console.warn('[TilePrecache] Failed to cache API, status:', apiResponse.status)
      }
    } catch (e) {
      console.error('[TilePrecache] Failed to cache API', e)
    }

    // Завершаем
    localStorage.setItem(PRECACHE_KEY, PRECACHE_VERSION)
    this.isPrecaching = false
    console.log('[TilePrecache] Загрузка завершена!')
    this.onCompleteCallback?.()
  }

  getProgress() {
    return { loaded: this.loadedTiles, total: this.totalTiles, isActive: this.isPrecaching }
  }

  isPrecached(): boolean {
    return localStorage.getItem(PRECACHE_KEY) === PRECACHE_VERSION
  }
}

export const tilePrecacheService = new TilePrecacheService()