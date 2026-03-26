import { useEffect, useRef, useState } from 'react'
import { MapContext } from '../context/MapContext'
import type { Coordinates } from '../types'
import { useYandexLoader } from '../hooks/useYandexLoader'

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
  
  // Используем существующий хук для загрузки API
  const { isLoaded } = useYandexLoader()

  // создание карты (только когда API загружен и контейнер готов)
  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapRef.current) return

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
  }, [isLoaded]) // Только когда API загружен

  // обновление центра
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return

    if (
      !lastCenterRef.current ||
      lastCenterRef.current[0] !== center[0] ||
      lastCenterRef.current[1] !== center[1]
    ) {
      map.setCenter(center)
      lastCenterRef.current = center
    }
  }, [center, isLoaded])

  // обработчик клика
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded || readOnly || !onSelect) return

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
  }, [onSelect, readOnly, isLoaded])

  // Показываем заглушку пока API не готов
  if (!isLoaded) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          minHeight: 200,
          borderRadius: '12px',
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
          minHeight: 200,
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      />
      {children}
    </MapContext.Provider>
  )
}