import type { PaymentsChangeDto } from '../../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'
import { formatNotificationDateOnly } from '../../utils/date'

interface Props {
  data: PaymentsChangeDto
}

export function PaymentsDiff({ data }: Props) {
  const { addedPayments, removedPayments, changedPayments } = data

  const hasAdded = addedPayments?.length > 0
  const hasRemoved = removedPayments?.length > 0
  const hasChanged = changedPayments?.length > 0

  if (!hasAdded && !hasRemoved && !hasChanged) return null

  return (
    <div className={surfaceStyles.diffList}>

      {hasChanged && (
        <Category title="Изменения">
          {changedPayments.map((item) => (
            <PaymentItem key={item.id} type="changed" oldP={item.old} newP={item.new} />
          ))}
        </Category>
      )}

      {hasAdded && (
        <Category title="Добавлено">
          {addedPayments.map((item) => (
            <PaymentItem key={`added-${item.id}-${item.amount}`} type="added" newP={item} />
          ))}
        </Category>
      )}

      {hasRemoved && (
        <Category title="Удалено">
          {removedPayments.map((item) => (
            <PaymentItem key={`removed-${item.id}-${item.amount}`} type="removed" oldP={item} />
          ))}
        </Category>
      )}

    </div>
  )
}

function Category({ title, children }: any) {
  return (
    <div className={surfaceStyles.diffGroup}>
      <div className={surfaceStyles.diffGroupTitle}>{title}</div>
      {children}
    </div>
  )
}

function PaymentItem({
  type,
  oldP,
  newP,
}: {
  type: 'added' | 'removed' | 'changed'
  oldP?: any
  newP?: any
}) {
  const title = newP?.paymentType || oldP?.paymentType || '—'

  const formatDate = (d?: string) =>
    d ? formatNotificationDateOnly(d) : '—'

  return (
    <div className={surfaceStyles.diffCard}>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className={surfaceStyles.diffTitle}>{title}</div>

        <span className={`${surfaceStyles.diffBadge} ${type === 'added'
          ? surfaceStyles.diffBadgeAdded
          : type === 'removed'
            ? surfaceStyles.diffBadgeRemoved
            : surfaceStyles.diffBadgeChanged
          }`}>
          {type === 'added' ? 'Добавлено' : type === 'removed' ? 'Удалено' : 'Изменено'}
        </span>
      </div>

      <DiffRow label="Сумма" oldValue={oldP?.amount} newValue={newP?.amount} type={type} />
      <DiffRow label="Дата" oldValue={formatDate(oldP?.paymentDate)} newValue={formatDate(newP?.paymentDate)} type={type} />
      <DiffRow label="Примечание" oldValue={oldP?.note} newValue={newP?.note} type={type} />
    </div>
  )
}

function DiffRow({ label, oldValue, newValue, type }: any) {
  if (type === 'added') {
    if (!newValue) return null
    return <div className={surfaceStyles.diffField}><div>{label}</div><span className={surfaceStyles.diffNew}>{newValue}</span></div>
  }

  if (type === 'removed') {
    if (!oldValue) return null
    return <div className={surfaceStyles.diffField}><div>{label}</div><span className={surfaceStyles.diffOldChanged}>{oldValue}</span></div>
  }

  if (oldValue === newValue) return null

  return (
    <div className={surfaceStyles.diffField}>
      <div>{label}</div>
      <div className={surfaceStyles.diffValues}>
        <span className={surfaceStyles.diffOldChanged}>{oldValue ?? '—'}</span>
        <span className={surfaceStyles.diffArrow}>→</span>
        <span className={surfaceStyles.diffNewChanged}>{newValue ?? '—'}</span>
      </div>
    </div>
  )
}