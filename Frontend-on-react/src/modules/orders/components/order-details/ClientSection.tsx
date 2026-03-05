import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'

import { PhoneLink } from '@/shared/ui/PhoneLink'

interface Props {
  fullName: string
  email?: string | null
  phone: string
  address: string
}

export function ClientSection({
  fullName,
  email,
  phone,
  address,
}: Props) {
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Клиент</h2>

      <div className={layout.grid2}>
        <div className={layout.field}>
          <span className={layout.label}>ФИО</span>
          <span className={layout.value}>{fullName}</span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Email</span>
          <span className={layout.value}>{email || '—'}</span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Телефон</span>
          <span className={layout.value}>
            <PhoneLink
              phone={phone}
              className={layout.value}
            />
          </span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Адрес</span>
          <span className={layout.value}>{address}</span>
        </div>
      </div>
    </section>
  )
}