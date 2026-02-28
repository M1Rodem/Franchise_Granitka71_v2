import { OrderFormProvider } from '@/modules/orders/components/order-form/order-form.provider'
import { LocationSection } from '@/modules/orders/components/order-form/sections/location-section'
import { ClientSection } from '@/modules/orders/components/order-form/sections/client-section'
import { DeceasedSection } from '@/modules/orders/components/order-form/sections/deceased-section'
import { MonumentSection } from '@/modules/orders/components/order-form/sections/monument-section'
import { WorksSection } from '@/modules/orders/components/order-form/sections/works-section'
import { PaymentsSection } from '@/modules/orders/components/order-form/sections/payments-section'
import { MediaSection } from '@/modules/orders/components/order-form/sections/media-section'
import { AdditionalInfoSection } from '@/modules/orders/components/order-form/sections/additional-info-section'
import { OrderFormActions } from '@/modules/orders/components/order-form/sections/order-form-actions'

import styles from './create-order.page.module.css'

export default function CreateOrderPage() {
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

        <div className={styles.actions}>
          <OrderFormActions />
        </div>
      </div>
    </OrderFormProvider>
  )
}