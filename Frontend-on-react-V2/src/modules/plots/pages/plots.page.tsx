import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'

import button from '@/shared/ui/button.module.css'
import input from '@/shared/ui/input.module.css'

import { queryClient } from '@/app/providers/query-client'
import { plotsApi } from '@/modules/plots/api/plots.api'
import { usePlotsPage } from '@/modules/plots/hooks/use-plots-options'
import { PlotsFilterBar } from '@/modules/plots/components/PlotsFilterBar'
import { PlotsTable } from '@/modules/plots/components/PlotsTable'
import type { PlotDto } from '@/modules/plots/types/plots.types'

import { OrdersStateView } from '@/modules/orders/components/OrdersStateView'
import { FormModal } from '@/shared/ui/modal/FormModal'
import { MapPreviewModal } from '@/shared/ui/modal/MapPreviewModal'
import { useConfirmModalStore } from '@/shared/ui/modal/modal.store'
import { PlotsPagination } from '@/modules/plots/components/PlotsPagination'

import { useUiStore } from '@/shared/store/ui.store'

import {
  YandexMapProvider,
  MapView,
  MapMarker,
} from '@/shared/lib/yandex-map'

import styles from './plots.page.module.css'

export default function PlotsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const pageSize = 10

  const plotsQuery = usePlotsPage(page, search)

  const items = plotsQuery.data?.items ?? []
  const total = plotsQuery.data?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  const isFetching = plotsQuery.isFetching
  const openConfirm = useConfirmModalStore((state) => state.open)

  const isCreateOpen = useUiStore((s) => s.plotCreateOpen)
  const closeCreateModal = useUiStore((s) => s.closePlotCreateModal)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  const [mapPlot, setMapPlot] = useState<PlotDto | null>(null)

  const setHeader = useUiStore((s) => s.setPlotsHeader)
  const resetHeader = useUiStore((s) => s.resetHeader)

  useEffect(() => {
    setHeader()

    return () => {
      resetHeader()
    }
  }, [setHeader, resetHeader])

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

  const onReset = () => {
    setSearch('')
    setPage(1)
  }

  const handleCreate = async () => {
    if (!latitude || !longitude) return

    await createMutation.mutateAsync({
      name,
      latitude,
      longitude,
      description: address,
      isActive: true,
    })

    closeCreateModal()
    setName('')
    setAddress('')
    setLatitude(null)
    setLongitude(null)
  }

  return (
    <div className={styles.pageWrapper}>
      <PlotsFilterBar
        search={search}
        isFetching={isFetching}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        onReset={onReset}
      />

      {plotsQuery.isError && (
        <OrdersStateView
          title="Ошибка загрузки"
          message="Не удалось загрузить список участков."
        />
      )}

      {!plotsQuery.isPending && items.length > 0 && (
        <AnimatePresence mode="wait">
          <motion.div
            key="plots-table"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <PlotsTable
              plots={items}
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

            <PlotsPagination
              page={page}
              totalPages={totalPages}
              totalCount={total}
              isFetching={plotsQuery.isFetching}
              onPageChange={setPage}
            />
          </motion.div>
        </AnimatePresence>
      )}

      <FormModal
        isOpen={isCreateOpen}
        title="Добавить участок"
        onClose={closeCreateModal}
        footer={
          <>
            <button
              type="button"
              className={`${button.btn} ${button.btnSecondary}`}
              onClick={() => closeCreateModal()}
            >
              Отмена
            </button>

            <button
              type="button"
              className={`${button.btn} ${button.btnSuccess}`}
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
          <div className={styles.modalForm}>
            <div className={styles.formRow}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={input.input}
                placeholder="Название участка"
              />
            </div>

            <div className={styles.formRow}>
              <input
                type="text"
                value={address}
                readOnly
                className={input.input}
                placeholder="Адрес определяется автоматически"
              />
            </div>

            <div className={styles.mapHeader}>
              Выберите точку на карте
            </div>

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
                  {latitude !== null && longitude !== null && (
                    <MapMarker coords={[latitude, longitude]} />
                  )}
                </MapView>
              </YandexMapProvider>
            </div>
          </div>
        </div>
      </FormModal>

      <MapPreviewModal
        isOpen={!!mapPlot}
        onClose={() => setMapPlot(null)}
      >
        {mapPlot && (
          <div
            className={styles.viewMapContainer}
            data-map
            onClick={(e) => e.stopPropagation()}
          >
            <YandexMapProvider>
              <MapView
                center={[mapPlot.latitude, mapPlot.longitude]}
                readOnly
              >
                <MapMarker coords={[mapPlot.latitude, mapPlot.longitude]} />
              </MapView>
            </YandexMapProvider>
          </div>
        )}
      </MapPreviewModal>
    </div>
  )
}
