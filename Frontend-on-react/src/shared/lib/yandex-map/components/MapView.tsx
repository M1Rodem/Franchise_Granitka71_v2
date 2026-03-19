import { useEffect, useRef, useState } from 'react'
import { MapContext } from '../context/MapContext'
import type { Coordinates } from '../types'

declare global {
  interface Window {
    ymaps?: any
  }
}

interface Props {
  center: Coordinates
  zoom?: number
  readOnly?: boolean
  onSelect?: (coords: Coordinates) => void
  onReady?: (map: any) => void
  children?: React.ReactNode
}

export function MapView({
  center,
  zoom = 14,
  readOnly = false,
  onSelect,
  onReady,
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const clickHandlerRef = useRef<any>(null)
  const lastCenterRef = useRef<Coordinates | null>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [isApiReady, setIsApiReady] = useState(false)

  // Проверяем загрузку API
  useEffect(() => {
    // Если API уже загружен
    if (window.ymaps) {
      window.ymaps.ready(() => {
        setIsApiReady(true)
      })
      return
    }

    // Проверяем каждые 100мс в течение 5 секунд
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      if (window.ymaps) {
        clearInterval(interval)
        window.ymaps.ready(() => {
          setIsApiReady(true)
        })
      } else if (attempts > 50) { // 5 секунд * 10 = 50 попыток
        clearInterval(interval)
        console.error('Yandex Maps API failed to load')
      }
    }, 100)

    return () => clearInterval(interval)
  }, [])

  // создание карты
  useEffect(() => {
    // Ждем готовности API и контейнера
    if (!isApiReady || !containerRef.current || mapRef.current) return

    try {
      const map = new window.ymaps.Map(containerRef.current, {
        center,
        zoom,
        controls: ['zoomControl'],
      })

      mapRef.current = map
      setMapInstance(map)
      lastCenterRef.current = center

      // Небольшая задержка для корректного рендера
      setTimeout(() => {
        if (map.container) {
          map.container.fitToViewport()
        }
      }, 100)

      if (onReady) {
        onReady(map)
      }
    } catch (error) {
      console.error('Failed to create map:', error)
    }
  }, [isApiReady]) // Зависимость только от isApiReady

  // обновление центра (без конфликтов)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isApiReady) return

    if (
      !lastCenterRef.current ||
      lastCenterRef.current[0] !== center[0] ||
      lastCenterRef.current[1] !== center[1]
    ) {
      map.setCenter(center)
      lastCenterRef.current = center
    }
  }, [center, isApiReady])

  // обработчик клика
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isApiReady || readOnly || !onSelect) return

    if (clickHandlerRef.current) {
      map.events.remove('click', clickHandlerRef.current)
    }

    const handler = (e: any) => {
      const coords = e.get('coords')
      onSelect(coords)
    }

    clickHandlerRef.current = handler
    map.events.add('click', handler)

    return () => {
      if (map && map.events) {
        map.events.remove('click', handler)
      }
    }
  }, [onSelect, readOnly, isApiReady])

  // Показываем заглушку пока API не готов
  if (!isApiReady) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#666' }}>Загрузка карты...</div>
      </div>
    )
  }

  return (
    <MapContext.Provider value={{ map: mapInstance }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      />
      {children}
    </MapContext.Provider>
  )
}