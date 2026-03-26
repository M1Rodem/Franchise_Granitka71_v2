import type { WorksChangeDto } from '../../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'

interface Props {
  data: WorksChangeDto
}

export function WorksDiff({ data }: Props) {
  return (
    <div className={surfaceStyles.surface}>
      <div className={surfaceStyles.diffList}>
        {[...data.oldWorks, ...data.newWorks]
          .map((_, index) => ({
            oldWork: data.oldWorks[index],
            newWork: data.newWorks[index],
          }))
          .filter(item => item.oldWork || item.newWork)
          .map(({ oldWork, newWork }, index) => {

          const isAdded = !oldWork && !!newWork
          const isRemoved = !!oldWork && !newWork
          const isChanged =
            oldWork &&
            newWork &&
            (
              oldWork.price !== newWork.price ||
              oldWork.quantity !== newWork.quantity ||
              oldWork.note !== newWork.note
            )

          const title =
            newWork?.workDescription || oldWork?.workDescription || '—'

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

              {/* КОЛИЧЕСТВО */}
              {oldWork?.quantity !== newWork?.quantity && (
                <DiffRow
                  label="Количество"
                  oldValue={oldWork?.quantity}
                  newValue={newWork?.quantity}
                />
              )}

              {/* ЦЕНА */}
              {oldWork?.price !== newWork?.price && (
                <DiffRow
                  label="Цена"
                  oldValue={oldWork?.price}
                  newValue={newWork?.price}
                />
              )}

              {/* ПРИМЕЧАНИЕ */}
              {oldWork?.note !== newWork?.note && (
                <DiffRow
                  label="Примечание"
                  oldValue={oldWork?.note || '—'}
                  newValue={newWork?.note || '—'}
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