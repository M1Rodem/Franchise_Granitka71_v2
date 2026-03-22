import type { PaymentsChangeDto } from '../../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'
import { formatNotificationDateTime } from '../../utils/date'

interface Props {
  data: PaymentsChangeDto
}

export function PaymentsDiff({ data }: Props) {
  return (
    <div className={surfaceStyles.surface}>
      <div className={surfaceStyles.diffList}>
        {[...data.oldPayments, ...data.newPayments]
          .map((_, index) => ({
            oldPayment: data.oldPayments[index],
            newPayment: data.newPayments[index],
          }))
          .filter(item => item.oldPayment || item.newPayment)
          .map(({ oldPayment, newPayment }, index) => {

          // тип изменения
          const isAdded = !oldPayment && !!newPayment
          const isRemoved = !!oldPayment && !newPayment
          const isChanged =
            oldPayment &&
            newPayment &&
            (
              oldPayment.amount !== newPayment.amount ||
              oldPayment.note !== newPayment.note ||
              oldPayment.paymentDate !== newPayment.paymentDate
            )

          const title =
            newPayment?.paymentType ||
            oldPayment?.paymentType ||
            '—'

          return (
            <div key={index} className={surfaceStyles.diffCard}>
              
              {/* HEADER */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div className={surfaceStyles.diffTitle}>
                  {title}
                </div>

                {isAdded && (
                  <span className={`${surfaceStyles.diffBadge} ${surfaceStyles.diffBadgeAdded}`}>
                    Добавлено
                  </span>
                )}

                {isRemoved && (
                  <span className={`${surfaceStyles.diffBadge} ${surfaceStyles.diffBadgeRemoved}`}>
                    Удалено
                  </span>
                )}

                {isChanged && (
                  <span className={`${surfaceStyles.diffBadge} ${surfaceStyles.diffBadgeChanged}`}>
                    Изменено
                  </span>
                )}
              </div>

              {/* СУММА */}
              {oldPayment?.amount !== newPayment?.amount && (
                <DiffRow
                  label="Сумма"
                  oldValue={oldPayment?.amount}
                  newValue={newPayment?.amount}
                />
              )}

              {/* ДАТА */}
              {oldPayment?.paymentDate !== newPayment?.paymentDate && (
                <DiffRow
                  label="Дата"
                  oldValue={
                    oldPayment?.paymentDate
                      ? formatNotificationDateTime(oldPayment.paymentDate)
                      : '—'
                  }
                  newValue={
                    newPayment?.paymentDate
                      ? formatNotificationDateTime(newPayment.paymentDate)
                      : '—'
                  }
                />
              )}

              {/* ПРИМЕЧАНИЕ */}
              {oldPayment?.note !== newPayment?.note && (
                <DiffRow
                  label="Примечание"
                  oldValue={oldPayment?.note || '—'}
                  newValue={newPayment?.note || '—'}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DiffRow({
  label,
  oldValue,
  newValue,
}: {
  label: string
  oldValue: string | number | null | undefined
  newValue: string | number | null | undefined
}) {
  const changed = oldValue !== newValue

  return (
    <div className={surfaceStyles.diffField}>
      <div className={surfaceStyles.diffLabel}>{label}</div>

      <div className={surfaceStyles.diffValues}>
        <span
          className={
            changed
              ? surfaceStyles.diffOldChanged
              : surfaceStyles.diffOld
          }
        >
          <span className={surfaceStyles.hideOnDesktop}>Было: </span>
          {oldValue ?? '—'}
        </span>

        <span className={surfaceStyles.diffArrow}>→</span>

        <span
          className={
            changed
              ? surfaceStyles.diffNewChanged
              : surfaceStyles.diffNew
          }
        >
          <span className={surfaceStyles.hideOnDesktop}>Стало: </span>
          {newValue ?? '—'}
        </span>
      </div>
    </div>
  )
}