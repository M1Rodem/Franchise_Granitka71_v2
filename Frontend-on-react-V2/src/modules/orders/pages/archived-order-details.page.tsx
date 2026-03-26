import { useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { ordersApi } from '@/modules/orders/api/orders.api'
import { ordersKeys } from '@/modules/orders/lib/orders.keys'
import type { OrderDetailsDto } from '@/modules/orders/types/orders.types'

import { usePlots } from '@/modules/plots/hooks/use-plots'
import { useUiStore } from '@/shared/store/ui.store'

import { ClientSection } from '@/modules/orders/components/order-details/ClientSection'
import { DeceasedSection } from '@/modules/orders/components/order-details/DeceasedSection'
import { MonumentSection } from '@/modules/orders/components/order-details/MonumentSection'
import { MetadataSection } from '@/modules/orders/components/order-details/MetadataSection'
import { InstallationSection } from '@/modules/orders/components/order-details/InstallationSection'
import { WorksSection } from '@/modules/orders/components/order-details/WorksSection'
import { PaymentsSection } from '@/modules/orders/components/order-details/PaymentsSection'
import { FinancialSection } from '@/modules/orders/components/order-details/FinancialSection'
import { MediaSection } from '@/modules/orders/components/order-details/MediaSection'
import { AdditionalInfoSection } from '@/modules/orders/components/order-details/AdditionalInfoSection'
import { ArchivedOrderActions } from '@/modules/orders/components/order-details/ArchivedOrderActions'
import { ArchivedOrderBanner } from '@/modules/orders/components/order-details/ArchivedOrderBanner'
import { OrdersTableSkeleton } from '@/modules/orders/components/OrdersTableSkeleton'

import styles from './order-details.page.module.css'

export default function ArchivedOrderDetailsPage() {

  const { id } = useParams<{ id: string }>()

  const setOrderDetailsHeader = useUiStore((s) => s.setOrderDetailsHeader)
  const resetHeader = useUiStore((s) => s.resetHeader)

  const numericId = useMemo(() => {
    if (!id) return null
    const parsed = Number(id)
    return Number.isNaN(parsed) ? null : parsed
  }, [id])

  const { data, isLoading, isError } = useQuery<OrderDetailsDto>({
    queryKey: numericId
      ? ordersKeys.archivedById(numericId)
      : ['orders', 'archivedById', 'invalid'],
    queryFn: () => {
      if (!numericId) throw new Error('Invalid order id')
      return ordersApi.getArchivedById(numericId)
    },
    enabled: !!numericId,
  })

  const plotsQuery = usePlots()
    const resolvedPlotName = useMemo(() => {
        if (data?.plotName) return data.plotName

        if (data?.plotId && plotsQuery.data) {
            const plot = plotsQuery.data.find(p => p.id === data.plotId)
            return plot?.name ?? null
        }

        return null
    }, [data?.plotName, data?.plotId, plotsQuery.data])

  const plotCoordinates = useMemo(() => {
    if (!data || !plotsQuery.data) return null

    const selectedPlot =
        (typeof data.plotId === 'number'
        ? plotsQuery.data.find((p) => p.id === data.plotId)
        : null) ??
        (data.plotName
        ? plotsQuery.data.find((p) => p.name === data.plotName)
        : null) ??
        plotsQuery.data.find((p) => p.name === data.place)

    const latitude = selectedPlot?.latitude
    const longitude = selectedPlot?.longitude

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return null
    }

    return [latitude, longitude] as [number, number]
    }, [data, plotsQuery.data])

    const destinationCoordinates = useMemo(() => {
    if (
        typeof data?.latitude !== 'number' ||
        typeof data?.longitude !== 'number'
    ) {
        return null
    }

    return [data.latitude, data.longitude] as [number, number]
    }, [data])

  useEffect(() => {
    if (data) {
      setOrderDetailsHeader(data.orderNumber)
    }

    return () => {
      resetHeader()
    }
  }, [data, setOrderDetailsHeader, resetHeader])

  if (isLoading) {
    return (
        <div className={styles.page}>
        <OrdersTableSkeleton />
        </div>
    )
  }

  if (isError || !data) {
    return (
      <div className={styles.stateContainer}>
        <div className={styles.error}>Ошибка загрузки заказа</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>

      <ArchivedOrderBanner deletedAt={data.deletedAt} />

      <ClientSection
        fullName={data.customerFullName}
        email={data.customerEmail}
        phone={data.phone}
        address={data.address}
      />

      <DeceasedSection deceasedFullName={data.deceasedFullName} />

      <MonumentSection
        type={(data.monumentType as string) ?? ''}
        size={(data.monumentSize as string) ?? ''}
      />

      <MetadataSection
        manager={data.managerFullName}
        orderDate={data.orderDate}
        createdAt={data.createdAt}
        updatedAt={data.updatedAt}
      />

      <InstallationSection
        plotName={resolvedPlotName}
        place={data.place}
        inspectionPlace={data.inspectionPlace}
        latitude={data.latitude}
        longitude={data.longitude}
        distanceKm={
            data.workItems.find(
            w => w.workDescription === 'Расстояние'
            )?.quantity ?? null
        }
        plotCoordinates={plotCoordinates}
        destinationCoordinates={destinationCoordinates}
      />

      <WorksSection items={data.workItems} />

      <FinancialSection
        subtotal={data.subtotal}
        discountPercent={data.discountPercent}
        discountAmount={data.discountAmount}
        totalPrice={data.totalPrice}
        payments={data.payments}
      />

      <PaymentsSection items={data.payments} />

      <MediaSection items={data.photos} />

      <AdditionalInfoSection
        additionalInfo={(data.additionalInfo as string) ?? ''}
      />
      <ArchivedOrderActions orderId={data.id} />
    </div>
  )
}