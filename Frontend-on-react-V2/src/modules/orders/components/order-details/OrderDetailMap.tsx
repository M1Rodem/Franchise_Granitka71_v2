import { useEffect, useRef, useState } from 'react';
import {
  YandexMapProvider,
  MapView,
  MapMarker,
} from '@/shared/lib/yandex-map';

declare global {
  interface Window {
    ymaps?: any;
  }
}

interface Props {
  plotCoordinates: [number, number] | null;
  destinationCoordinates: [number, number] | null;
}

export function OrderDetailMap({
  plotCoordinates,
  destinationCoordinates,
}: Props) {
  const mapRef = useRef<any>(null);
  const routeRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const hasPlot = !!plotCoordinates;
  const hasDestination = !!destinationCoordinates;
  const hasRoute = hasPlot && hasDestination;

  useEffect(() => {
    if (!isMapReady) return;
    if (!window.ymaps) return;
    if (!hasRoute) return;

    const map = mapRef.current;
    if (!map) return;

    // удалить старый маршрут
    if (routeRef.current) {
      map.geoObjects.remove(routeRef.current);
      routeRef.current = null;
    }

    const multiRoute = new window.ymaps.multiRouter.MultiRoute(
      {
        referencePoints: [
          plotCoordinates!,
          destinationCoordinates!,
        ],
      },
      {
        boundsAutoApply: true,
      }
    );

    multiRoute.options.set({
      wayPointVisible: false,
    });

    map.geoObjects.add(multiRoute);
    routeRef.current = multiRoute;

    multiRoute.model.events.add('requestsuccess', () => {
      const activeRoute = multiRoute.getActiveRoute();
      if (!activeRoute) return;

      const bounds = activeRoute.getBounds?.();
      if (bounds) {
        map.setBounds(bounds, {
          checkZoomRange: true,
          zoomMargin: 40,
        });
      }
    });

    return () => {
      if (routeRef.current) {
        map.geoObjects.remove(routeRef.current);
        routeRef.current = null;
      }
    };
  }, [
    isMapReady,
    plotCoordinates?.[0],
    plotCoordinates?.[1],
    destinationCoordinates?.[0],
    destinationCoordinates?.[1],
  ]);

  const center =
    plotCoordinates ??
    destinationCoordinates ??
    [55.75, 37.57];

  return (
    <YandexMapProvider>
      <MapView
        center={center as [number, number]}
        zoom={14}
        readOnly
        onReady={(map: any) => {
          mapRef.current = map;
          setIsMapReady(true);
        }}
      >
        {hasPlot && <MapMarker coords={plotCoordinates!} />}
        {hasDestination && (
          <MapMarker coords={destinationCoordinates!} />
        )}
      </MapView>
    </YandexMapProvider>
  );
}