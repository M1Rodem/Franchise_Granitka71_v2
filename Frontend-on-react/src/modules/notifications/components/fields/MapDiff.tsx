import { useState } from 'react'
import type { MapChangeDto } from '../../types/notifications.types'
import {
  YandexMapProvider,
  MapView,
  MapMarker,
  RouteBuilder,
} from '@/shared/lib/yandex-map'
import surfaceStyles from '@/shared/ui/surface.module.css'
import { usePlots } from '@/modules/plots/hooks/use-plots'
import buttonStyles from '@/shared/ui/button.module.css'

interface Props {
  data: MapChangeDto
}

export function MapDiff({ data }: Props) {
  console.log('[Notifications DEBUG] MapDiff data', data)

  const oldMap = data.old
  const newMap = data.new

  const [showOldMap, setShowOldMap] = useState(true)
  const { data: plots } = usePlots()

  // --- helpers ---
  const getPlotCoords = (
    plotName: string | null | undefined
  ): [number, number] | null => {
    if (!plotName || !plots) return null

    const plot = plots.find((p) => p.name === plotName)

    if (plot && plot.latitude && plot.longitude) {
      return [plot.latitude, plot.longitude]
    }

    return null
  }

  const buildYandexLink = (
    plotCoords: [number, number] | null,
    destCoords: [number, number] | null
  ) => {
    if (plotCoords && destCoords) {
      return `https://yandex.ru/maps/?rtext=${plotCoords[0]},${plotCoords[1]}~${destCoords[0]},${destCoords[1]}&rtt=auto`
    }

    if (destCoords) {
      return `https://yandex.ru/maps/?pt=${destCoords[1]},${destCoords[0]}&z=16`
    }

    if (plotCoords) {
      return `https://yandex.ru/maps/?pt=${plotCoords[1]},${plotCoords[0]}&z=16`
    }

    return null
  }

  const calculateDistanceKm = (
    from: [number, number],
    to: [number, number]
  ) => {
    const toRad = (value: number) => (value * Math.PI) / 180

    const R = 6371 // радиус Земли в км

    const dLat = toRad(to[0] - from[0])
    const dLon = toRad(to[1] - from[1])

    const lat1 = toRad(from[0])
    const lat2 = toRad(to[0])

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) *
        Math.sin(dLon / 2) *
        Math.cos(lat1) *
        Math.cos(lat2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  // --- coords ---
  const oldPlotCoords = getPlotCoords(oldMap.plot)
  const newPlotCoords = getPlotCoords(newMap.plot)

  const oldDestinationCoords: [number, number] | null =
    oldMap.latitude && oldMap.longitude
      ? [oldMap.latitude, oldMap.longitude]
      : null

  const newDestinationCoords: [number, number] | null =
    newMap.latitude && newMap.longitude
      ? [newMap.latitude, newMap.longitude]
      : null

  // --- flags ---
  const plotChanged = oldMap.plot !== newMap.plot

  const coordinatesChanged =
    oldMap.latitude !== newMap.latitude ||
    oldMap.longitude !== newMap.longitude

  const inspectionPlaceChanged =
    oldMap.inspectionPlace !== newMap.inspectionPlace

  const distanceChanged =
    oldMap.distanceKm !== newMap.distanceKm

  const hasMapChanges = plotChanged || coordinatesChanged

  const oldDistanceBetween =
    oldPlotCoords && oldDestinationCoords
      ? calculateDistanceKm(oldPlotCoords, oldDestinationCoords)
      : null

  const newDistanceBetween =
    newPlotCoords && newDestinationCoords
      ? calculateDistanceKm(newPlotCoords, newDestinationCoords)
      : null

  if (!hasMapChanges && !inspectionPlaceChanged && !distanceChanged) {
    return null
  }

  // --- changes text ---
  const changes: string[] = []

  if (plotChanged) {
    changes.push(
      `Участок: ${oldMap.plot || 'не выбран'} → ${
        newMap.plot || 'не выбран'
      }`
    )
  }

  if (coordinatesChanged) {
    const oldCoords =
      oldMap.latitude && oldMap.longitude
        ? `${oldMap.latitude.toFixed(6)}, ${oldMap.longitude.toFixed(6)}`
        : 'не указаны'

    const newCoords =
      newMap.latitude && newMap.longitude
        ? `${newMap.latitude.toFixed(6)}, ${newMap.longitude.toFixed(6)}`
        : 'не указаны'

    changes.push(`Точка: ${oldCoords} → ${newCoords}`)
  }

  if (inspectionPlaceChanged) {
    changes.push(
      `Место смотрел: ${oldMap.inspectionPlace || 'не указано'} → ${
        newMap.inspectionPlace || 'не указано'
      }`
    )
  }

  if (distanceChanged) {
    changes.push(
      `Расстояние: ${
        oldMap.distanceKm?.toFixed(2) || '0'
      } км → ${newMap.distanceKm?.toFixed(2) || '0'} км`
    )
  }

  if (oldDistanceBetween !== newDistanceBetween) {
    const oldVal =
      oldDistanceBetween !== null
        ? oldDistanceBetween.toFixed(2)
        : '—'

    const newVal =
      newDistanceBetween !== null
        ? newDistanceBetween.toFixed(2)
        : '—'

    const diffNumber =
      oldDistanceBetween !== null && newDistanceBetween !== null
        ? newDistanceBetween - oldDistanceBetween
        : null

    const diff =
      diffNumber !== null ? diffNumber.toFixed(2) : null

    changes.push(
      `Расстояние между точками: ${oldVal} км → ${newVal} км${
        diff
          ? ` (${diffNumber! > 0 ? '+' : ''}${diff} км)`
          : ''
      }`
    )
  }

  // --- map renderer ---
  const renderMap = (
    plotCoords: [number, number] | null,
    destCoords: [number, number] | null
  ) => {
    const hasPlot = !!plotCoords
    const hasDestination = !!destCoords
    const hasRoute = hasPlot && hasDestination

    const center =
      plotCoords ??
      destCoords ??
      [55.75, 37.57]

    if (!hasPlot && !hasDestination) {
      return (
        <div
          style={{
            width: '100%',
            height: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            borderRadius: '12px',
            color: '#999',
          }}
        >
          Нет данных для отображения
        </div>
      )
    }

    return (
      <YandexMapProvider>
        <MapView center={center} zoom={14} readOnly>
          {hasPlot && <MapMarker coords={plotCoords!} />}
          {hasDestination && (
            <MapMarker coords={destCoords!} />
          )}

          {hasRoute && (
            <RouteBuilder
              from={plotCoords!}
              to={destCoords!}
            />
          )}
        </MapView>
      </YandexMapProvider>
    )
  }

  // --- UI ---
  return (
    <div className={surfaceStyles.surface}>
      {hasMapChanges && (
        <>
          <div className={buttonStyles.mapToggle}>
            <button
              onClick={() => setShowOldMap(true)}
              className={`${buttonStyles.mapToggleBtn} ${
                showOldMap ? buttonStyles.mapToggleBtnActive : ''
              }`}
            >
              Было
            </button>

            <button
              onClick={() => setShowOldMap(false)}
              className={`${buttonStyles.mapToggleBtn} ${
                !showOldMap ? buttonStyles.mapToggleBtnActive : ''
              }`}
            >
              Стало
            </button>
          </div>

          <div
            style={{
              width: '100%',
              height: 400,
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid rgba(126, 164, 220, 0.2)',
              background: 'rgba(10, 25, 50, 0.6)',
            }}
          >
            {showOldMap
              ? renderMap(oldPlotCoords, oldDestinationCoords)
              : renderMap(newPlotCoords, newDestinationCoords)}
          </div>
          {(() => {
            const link = showOldMap
              ? buildYandexLink(oldPlotCoords, oldDestinationCoords)
              : buildYandexLink(newPlotCoords, newDestinationCoords)

            if (!link) return null

            return (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles.mapLinkBtn}
              >
                Открыть в Яндекс.Картах ({showOldMap ? 'Было' : 'Стало'})
              </a>
            )
          })()}
        </>
      )}

      {/* текстовые изменения */}
      {changes.length > 0 && (
          <div className={surfaceStyles.diffList}>
            {changes.map((change, index) => {
              const [label, value = ''] = change.split(': ')

              let from = ''
              let to = ''
              let diffRaw = ''
              let diffNumber: number | null = null

              if (value.includes('(')) {
                const mainPart = value.split(' (')[0]
                diffRaw = value.match(/\((.*?)\)/)?.[1] || ''

                const parsed = parseFloat(diffRaw.replace('км', '').trim())
                diffNumber = isNaN(parsed) ? null : parsed

                const parts = mainPart.split(' → ')
                from = parts[0]
                to = parts[1]
              } else {
                const parts = value.split(' → ')
                from = parts[0]
                to = parts[1]
              }

              const isPositive = diffNumber !== null && diffNumber > 0

              return (
                <div key={index} className={surfaceStyles.diffCard}>
                  {/* TITLE */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div className={surfaceStyles.diffTitle}>
                      {label}
                    </div>

                    <span className={`${surfaceStyles.diffBadge} ${surfaceStyles.diffBadgeChanged}`}>
                      Изменено
                    </span>
                  </div>

                  {/* VALUE */}
                  <div className={surfaceStyles.diffField}>
                    <div className={surfaceStyles.diffLabel}>
                      Значение
                    </div>

                    <div className={surfaceStyles.diffValues}>
                      <span className={surfaceStyles.diffOldChanged}>
                        <span className={surfaceStyles.hideOnDesktop}>Было: </span>
                        {from}
                      </span>

                      <span className={surfaceStyles.diffArrow}>→</span>

                      <span className={surfaceStyles.diffNewChanged}>
                        <span className={surfaceStyles.hideOnDesktop}>Стало: </span>
                        {to}
                      </span>

                      {diffRaw && diffNumber !== null && (
                        <span
                          style={{
                            fontSize: 12,
                            color: isPositive ? '#6ee7b7' : '#fca5a5',
                            marginLeft: 6,
                          }}
                        >
                          ({diffRaw})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
      )}
    </div>
  )
}