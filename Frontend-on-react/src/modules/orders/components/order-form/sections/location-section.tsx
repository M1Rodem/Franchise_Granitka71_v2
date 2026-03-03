'use client'

import { useFormContext, Controller } from 'react-hook-form'
import { usePlots } from '@/modules/plots/hooks/use-plots'
import { AnimatedSelect } from '@/shared/ui/AnimatedSelect'
import type { OrderFormModel } from '../order-form.schema'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  YandexMapProvider,
  MapView,
  MapMarker,
} from '@/shared/lib/yandex-map'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'
import input from '@/shared/ui/input.module.css'
import button from '@/shared/ui/button.module.css'
import styles from './location-section.module.css'

export function LocationSection() {
  const { register, control, watch, setValue } =
    useFormContext<OrderFormModel>()

  const { data: plots } = usePlots()

  const plotId = watch('plotId')
  const selectedPlot = plots?.find(p => p.id === plotId)

  const mapRef = useRef<any>(null)
  const routeRef = useRef<any>(null)
  const destMarkerRef = useRef<any>(null)

  const [destination, setDestination] =
    useState<[number, number] | null>(null)

  // 🔹 очистка при смене участка
  useEffect(() => {
    if (!selectedPlot || !mapRef.current) return

    mapRef.current.setCenter(
      [selectedPlot.latitude, selectedPlot.longitude],
      15
    )

    setDestination(null)

    if (routeRef.current) {
      mapRef.current.geoObjects.remove(routeRef.current)
      routeRef.current = null
    }

    if (destMarkerRef.current) {
      mapRef.current.geoObjects.remove(destMarkerRef.current)
      destMarkerRef.current = null
    }

    setValue('latitude', selectedPlot.latitude)
    setValue('longitude', selectedPlot.longitude)
  }, [plotId])

  const handleSelect = useCallback(
    (coords: [number, number]) => {
      if (!selectedPlot || !mapRef.current) return

      setDestination(coords)

      setValue('latitude', coords[0])
      setValue('longitude', coords[1])

      // удалить старый маршрут
      if (routeRef.current) {
        mapRef.current.geoObjects.remove(routeRef.current)
        routeRef.current = null
      }

      // удалить старую точку
      if (destMarkerRef.current) {
        mapRef.current.geoObjects.remove(destMarkerRef.current)
        destMarkerRef.current = null
      }

      // создать новую точку назначения
      const destPlacemark =
        new window.ymaps.Placemark(coords, {}, {
          preset: 'islands#blueIcon',
        })

      mapRef.current.geoObjects.add(destPlacemark)
      destMarkerRef.current = destPlacemark

      // создать MultiRoute
      const multiRoute =
        new window.ymaps.multiRouter.MultiRoute(
          {
            referencePoints: [
              [selectedPlot.latitude, selectedPlot.longitude],
              coords,
            ],
          },
          {
            boundsAutoApply: true,
          }
        )

      // отключаем кликабельность маршрута
      multiRoute.options.set({
        wayPointVisible: false,
      })

      mapRef.current.geoObjects.add(multiRoute)
      routeRef.current = multiRoute

      // ждём построения маршрута
      multiRoute.model.events.add('requestsuccess', () => {
        const activeRoute =
          multiRoute.getActiveRoute()

        if (!activeRoute) return

        // отключаем события сегментов
        const paths = activeRoute.getPaths()
        paths.options.set({
          pointerEvents: 'none',
        })

        const distanceValue =
          Number(
            (
              activeRoute.properties
                .get('distance')
                .value / 1000
            ).toFixed(2)
          )

        setValue(
          'works.0.quantity',
          distanceValue,
          {
            shouldDirty: true,
            shouldValidate: true,
          }
        )
      })
    },
    [selectedPlot]
  )

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Местоположение
      </h2>

      <div className={layout.grid2}>
        <div className={layout.field}>
          <label className={layout.label}>
            Место осмотрел *
          </label>
          <input
            {...register('inspectionPlace')}
            className={input.input}
          />
        </div>

        <div className={layout.field}>
          <label className={layout.label}>
            Участок *
          </label>

          <Controller
            control={control}
            name="plotId"
            render={({ field }) => (
              <AnimatedSelect
                value={field.value ? String(field.value) : ''}
                options={
                  plots?.map(p => ({
                    value: String(p.id),
                    label: p.name,
                  })) ?? []
                }
                onChange={(val) =>
                  field.onChange(Number(val))
                }
              />
            )}
          />
        </div>
      </div>

      <div className={layout.field}>
        <label className={layout.label}>
          Маршрут до участка *
        </label>

        <div className={styles.mapContainer}>
          <YandexMapProvider>
            <MapView
              center={
                selectedPlot
                  ? [
                      selectedPlot.latitude,
                      selectedPlot.longitude,
                    ]
                  : [55.75, 37.57]
              }
              onReady={(map: any) => {
                mapRef.current = map
              }}
              onSelect={handleSelect}
            >
              {selectedPlot && (
                <MapMarker
                  coords={[
                    selectedPlot.latitude,
                    selectedPlot.longitude,
                  ]}
                />
              )}
            </MapView>
          </YandexMapProvider>
        </div>
      </div>

      <button
        type="button"
        className={`${button.btn} ${button.btnSecondary}`}
        disabled={!destination || !selectedPlot}
        onClick={() => {
          if (!destination || !selectedPlot) return

          const url =
            `https://yandex.ru/maps/?rtext=` +
            `${selectedPlot.latitude},${selectedPlot.longitude}` +
            `~${destination[0]},${destination[1]}`

          window.open(url, '_blank')
        }}
      >
        Открыть в навигаторе
      </button>
    </div>
  )
}