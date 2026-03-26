import { useEffect, useRef } from 'react';
import { useMapContext } from '../context/MapContext';
import type { Coordinates } from '../types';

declare global {
  interface Window {
    ymaps?: any;
  }
}

interface Props {
  from: Coordinates;
  to: Coordinates;
}

export function RouteBuilder({ from, to }: Props) {
  const { map } = useMapContext();
  const routeRef = useRef<any | null>(null);

  useEffect(() => {
    if (!map || !window.ymaps) return

    if (routeRef.current) {
      map.geoObjects.remove(routeRef.current)
    }

    const multiRoute = new window.ymaps.multiRouter.MultiRoute(
      {
        referencePoints: [from, to],
      },
      { boundsAutoApply: true }
    )

    multiRoute.options.set({
      wayPointVisible: false,
    })

    map.geoObjects.add(multiRoute)
    routeRef.current = multiRoute

    return () => {
      if (routeRef.current) {
        map.geoObjects.remove(routeRef.current)
      }
    }
  }, [from, to, map])

  return null;
}