import { useEffect, useRef, useContext } from 'react'
import { MapContext } from '../context/MapContext'
import type { Coordinates } from '../types'

declare global {
  interface Window {
    ymaps?: any
  }
}

interface Props {
  coords: Coordinates
}

export function MapMarker({ coords }: Props) {
  const { map } = useContext(MapContext)
  const placemarkRef = useRef<any>(null)

  useEffect(() => {
    if (!map || !window.ymaps) return

    // если уже есть маркер → удалить
    if (placemarkRef.current) {
      map.geoObjects.remove(placemarkRef.current)
      placemarkRef.current = null
    }

    const placemark = new window.ymaps.Placemark(coords, {}, {
      preset: 'islands#redIcon',
    })

    map.geoObjects.add(placemark)
    placemarkRef.current = placemark

    return () => {
      if (placemarkRef.current) {
        map.geoObjects.remove(placemarkRef.current)
      }
    }
  }, [map, coords])

  return null
}