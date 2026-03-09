import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { useEffect } from 'react'
import { useUiStore } from '@/shared/store/ui.store'

import { ordersApi } from '@/modules/orders/api/orders.api'
import { ordersKeys } from '@/modules/orders/lib/orders.keys'

import { OrderFormProvider } from '@/modules/orders/components/order-form/order-form.provider'

import { mapOrderToForm } from '@/modules/orders/lib/map-order-to-form'

import {
  ClientSection,
} from '@/modules/orders/components/order-form/sections/client-section'
import { usePlots } from '@/modules/plots/hooks/use-plots'
import { DeceasedSection } from '@/modules/orders/components/order-form/sections/deceased-section'
import { LocationSection } from '@/modules/orders/components/order-form/sections/location-section'
import { MonumentSection } from '@/modules/orders/components/order-form/sections/monument-section'
import { WorksSection } from '@/modules/orders/components/order-form/sections/works-section'
import { PaymentsSection } from '@/modules/orders/components/order-form/sections/payments-section'
import { MediaSection } from '@/modules/orders/components/order-form/sections/media-section'
import { AdditionalInfoSection } from '@/modules/orders/components/order-form/sections/additional-info-section'

import styles from './create-order.page.module.css'

export default function EditOrderPage() {
  const { id } = useParams()
  const numericId = Number(id)

  const { data, isLoading } = useQuery({
    queryKey: ordersKeys.byId(numericId),
    queryFn: () => ordersApi.getById(numericId),
    enabled: !!numericId,
  })
  const { data: plots } = usePlots()
  const setHeader = useUiStore((s) => s.setOrderEditHeader)
  const resetHeader = useUiStore((s) => s.resetHeader)

  const initialValues =
  data && plots
    ? mapOrderToForm(data, plots)
    : undefined

  useEffect(() => {
    if (data?.orderNumber) {
      setHeader(data.orderNumber)
    }

    return () => {
      resetHeader()
    }
  }, [data, setHeader, resetHeader])

  if (isLoading || !data || !plots) {
    return <div>Загрузка...</div>
  }

  return (
    <OrderFormProvider
      mode="edit"
      orderId={numericId}
      initialValues={initialValues}
    >
      <div className={styles.page}>
        <div className={styles.grid}>
          <div className={styles.col}>
            <ClientSection />
            <DeceasedSection />
          </div>

          <div className={styles.col}>
            <LocationSection />
            <MonumentSection />
          </div>
        </div>

        <WorksSection />
        <PaymentsSection />
        <MediaSection
        existing={data.photos.map((m) => ({
            ...m,
            mediaType: Number(m.mediaType),
        }))}
        />
        <AdditionalInfoSection />
      </div>
    </OrderFormProvider>
  )
}