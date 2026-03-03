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

  // создание карты
  useEffect(() => {
    if (!window.ymaps || !containerRef.current) return
    if (mapRef.current) return

    const map = new window.ymaps.Map(containerRef.current, {
      center,
      zoom,
      controls: ['zoomControl'],
    })

    mapRef.current = map
    setMapInstance(map)
    lastCenterRef.current = center

    setTimeout(() => {
      map.container.fitToViewport()
    }, 0)

    if (onReady) {
      onReady(map)
    }
  }, [])

  // обновление центра (без конфликтов)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (
      !lastCenterRef.current ||
      lastCenterRef.current[0] !== center[0] ||
      lastCenterRef.current[1] !== center[1]
    ) {
      map.setCenter(center)
      lastCenterRef.current = center
    }
  }, [center])

  // обработчик клика
  useEffect(() => {
    const map = mapRef.current
    if (!map || readOnly || !onSelect) return

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
      map.events.remove('click', handler)
    }
  }, [onSelect, readOnly])

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