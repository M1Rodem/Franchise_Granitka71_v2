import { OrderFormProvider } from '@/modules/orders/components/order-form/order-form.provider'
import { LocationSection } from '@/modules/orders/components/order-form/sections/location-section'
import { ClientSection } from '@/modules/orders/components/order-form/sections/client-section'
import { DeceasedSection } from '@/modules/orders/components/order-form/sections/deceased-section'
import { MonumentSection } from '@/modules/orders/components/order-form/sections/monument-section'
import { WorksSection } from '@/modules/orders/components/order-form/sections/works-section'
import { PaymentsSection } from '@/modules/orders/components/order-form/sections/payments-section'
import { MediaSection } from '@/modules/orders/components/order-form/sections/media-section'
import { AdditionalInfoSection } from '@/modules/orders/components/order-form/sections/additional-info-section'

import styles from './create-order.page.module.css'

import { useEffect } from 'react'
import { useUiStore } from '@/shared/store/ui.store'

export default function CreateOrderPage() {
  const setHeader = useUiStore((s) => s.setOrderCreateHeader)
  const resetHeader = useUiStore((s) => s.resetHeader)

  useEffect(() => {
    setHeader()

    return () => {
      resetHeader()
    }
  }, [setHeader, resetHeader])
  return (
    <OrderFormProvider>
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
        <MediaSection />
        <AdditionalInfoSection />
      </div>
    </OrderFormProvider>
  )
}