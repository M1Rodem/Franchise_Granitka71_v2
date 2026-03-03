import { useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'

import surface from '@/shared/ui/surface.module.css'
import button from '@/shared/ui/button.module.css'
import input from '@/shared/ui/input.module.css'

import { queryClient } from '@/app/providers/query-client'
import { plotsApi } from '@/modules/plots/api/plots.api'
import { usePlots } from '@/modules/plots/hooks/use-plots'
import { PlotsTable } from '@/modules/plots/components/PlotsTable'
import type { PlotDto } from '@/modules/plots/types/plots.types'

import { OrdersStateView } from '@/modules/orders/components/OrdersStateView'
import { FormModal } from '@/shared/ui/modal/FormModal'
import { useConfirmModalStore } from '@/shared/ui/modal/modal.store'

import {
  YandexMapProvider,
  MapView,
  MapMarker,
} from '@/shared/lib/yandex-map'

import styles from './plots.page.module.css'

export default function PlotsPage() {
  const plotsQuery = usePlots()
  const openConfirm = useConfirmModalStore((state) => state.open)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  const [mapPlot, setMapPlot] = useState<PlotDto | null>(null)

  const createMutation = useMutation({
    mutationFn: plotsApi.createPlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plots'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: plotsApi.deletePlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plots'] })
    },
  })

  const handleCreate = async () => {
    if (!latitude || !longitude) return

    await createMutation.mutateAsync({
      name,
      latitude,
      longitude,
      description: address,
      isActive: true,
    })

    setIsCreateOpen(false)
    setName('')
    setAddress('')
    setLatitude(null)
    setLongitude(null)
  }

  return (
    <div className={styles.pageWrapper}>
      <section className={surface.surface}>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${button.btn} ${button.btnPrimary}`}
            onClick={() => setIsCreateOpen(true)}
          >
            Добавить участок
          </button>
        </div>
      </section>

      {plotsQuery.isError && (
        <OrdersStateView
          title="Ошибка загрузки"
          message="Не удалось загрузить список участков."
        />
      )}

      {!plotsQuery.isPending &&
        plotsQuery.data &&
        plotsQuery.data.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key="plots-table"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <PlotsTable
                plots={plotsQuery.data}
                onDelete={(id) =>
                  openConfirm({
                    title: 'Удаление участка',
                    message: 'Удалить участок?',
                    confirmText: 'Удалить',
                    cancelText: 'Отмена',
                    onConfirm: async () => {
                      await deleteMutation.mutateAsync(id)
                    },
                  })
                }
                onShowMap={(plot) => setMapPlot(plot)}
              />
            </motion.div>
          </AnimatePresence>
        )}

      {/* CREATE MODAL */}
      <FormModal
        isOpen={isCreateOpen}
        title="Добавить участок"
        onClose={() => setIsCreateOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={`${button.btn} ${button.btnSecondary}`}
              onClick={() => setIsCreateOpen(false)}
            >
              Отмена
            </button>

            <button
              type="button"
              className={`${button.btn} ${button.btnPrimary}`}
              onClick={handleCreate}
              disabled={
                !name.trim() ||
                latitude === null ||
                longitude === null ||
                createMutation.isPending
              }
            >
              Сохранить
            </button>
          </>
        }
      >
        <div className={styles.modalContent}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={input.input}
            placeholder="Название участка"
          />

          <input
            type="text"
            value={address}
            readOnly
            className={input.input}
            placeholder="Адрес определяется автоматически"
          />

          <div className={styles.mapContainer}>
            <YandexMapProvider>
              <MapView
                center={[55.75, 37.57]}
                onReady={(map) => {
                  const searchControl = new window.ymaps.control.SearchControl({
                    options: {
                      noPlacemark: true,
                    },
                  })

                  map.controls.add(searchControl)

                  searchControl.events.add('resultselect', () => {
                    const index = searchControl.getSelectedIndex()
                    const result = searchControl.getResult(index)

                    result.then((res: any) => {
                      const coords = res.geometry.getCoordinates()

                      setLatitude(coords[0])
                      setLongitude(coords[1])
                      setAddress(res.getAddressLine())

                      map.setCenter(coords)
                    })
                  })
                }}
                onSelect={(coords) => {
                  setLatitude(coords[0])
                  setLongitude(coords[1])

                  window.ymaps.geocode(coords).then((res: any) => {
                    const first = res.geoObjects.get(0)
                    setAddress(first?.getAddressLine() ?? '')
                  })
                }}
              >
                {/* ✅ Маркер теперь внутри MapView, получит доступ к контексту */}
                {latitude !== null && longitude !== null && (
                  <MapMarker coords={[latitude, longitude]} />
                )}
              </MapView>
            </YandexMapProvider>
          </div>
        </div>
      </FormModal>

      {/* VIEW MAP MODAL */}
      <FormModal
        isOpen={!!mapPlot}
        title="Расположение участка"
        onClose={() => setMapPlot(null)}
      >
        {mapPlot && (
          <div className={styles.viewMapContainer}>
            <YandexMapProvider>
              <MapView
                center={[mapPlot.latitude, mapPlot.longitude]}
                readOnly
              >
                {/* ✅ Маркер теперь внутри MapView */}
                <MapMarker coords={[mapPlot.latitude, mapPlot.longitude]} />
              </MapView>
            </YandexMapProvider>
          </div>
        )}
      </FormModal>
    </div>
  )
}