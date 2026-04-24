import type { WorksChangeDto } from '../../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'

interface Props {
  data: WorksChangeDto
}

export function WorksDiff({ data }: Props) {

  const oldMap = new Map(data.oldWorks.map(w => [w.id, w]))
  const newMap = new Map(data.newWorks.map(w => [w.id, w]))

  const items = [
    ...data.oldWorks.map(w => ({
      key: `old-${w.id}-${w.workDescription}`,
      oldWork: w,
      newWork: newMap.get(w.id),
    })),
    ...data.newWorks
      .filter(w => !oldMap.has(w.id))
      .map(w => ({
        key: `new-${w.id}-${w.workDescription}`,
        oldWork: undefined,
        newWork: w,
      }))
  ]

  return (
    <div className={surfaceStyles.surface}>
      <div className={surfaceStyles.diffList}>

        {items.map(({ oldWork, newWork, key }) => {

          const isAdded = !oldWork && !!newWork
          const isRemoved = !!oldWork && !newWork

          const isChanged =
            oldWork &&
            newWork &&
            (
              oldWork.price !== newWork.price ||
              oldWork.quantity !== newWork.quantity ||
              oldWork.routes !== newWork.routes ||
              oldWork.distanceKm !== newWork.distanceKm ||
              oldWork.note !== newWork.note
            )

          if (!isAdded && !isRemoved && !isChanged) {
            return null
          }

          const isDistance =
            newWork?.isDistanceWork ?? oldWork?.isDistanceWork

          const title =
            newWork?.workDescription ||
            oldWork?.workDescription ||
            '—'

          return (
            <div key={key} className={surfaceStyles.diffCard}>

              {/* HEADER */}
              <div className={surfaceStyles.diffField}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>

                  <div className={surfaceStyles.diffField}>
                    <div className={surfaceStyles.diffLabel}>Название</div>
                    <div className={surfaceStyles.diffTitle}>
                      {isAdded
                        ? newWork?.workDescription
                        : isRemoved
                          ? oldWork?.workDescription
                          : title}
                    </div>
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
              </div>

              {/* DISTANCE */}
              {isDistance ? (
                <>
                  <DiffRow label="Рейсы" oldValue={oldWork?.routes} newValue={newWork?.routes} mode={getMode(isAdded, isRemoved)} />
                  <DiffRow label="Км за рейс" oldValue={oldWork?.distanceKm} newValue={newWork?.distanceKm} mode={getMode(isAdded, isRemoved)} />
                  <DiffRow label="Итого км" oldValue={oldWork?.quantity} newValue={newWork?.quantity} mode={getMode(isAdded, isRemoved)} />
                  <DiffRow label="Цена за км" oldValue={oldWork?.price} newValue={newWork?.price} mode={getMode(isAdded, isRemoved)} />
                </>
              ) : (
                <>
                  <DiffRow label="Количество" oldValue={oldWork?.quantity} newValue={newWork?.quantity} mode={getMode(isAdded, isRemoved)} />
                  <DiffRow label="Цена" oldValue={oldWork?.price} newValue={newWork?.price} mode={getMode(isAdded, isRemoved)} />
                </>
              )}

              <DiffRow
                label="Примечание"
                oldValue={oldWork?.note}
                newValue={newWork?.note}
                mode={getMode(isAdded, isRemoved)}
              />

            </div>
          )
        })}

      </div>
    </div>
  )
}

function getMode(isAdded: boolean, isRemoved: boolean) {
  if (isAdded) return 'added'
  if (isRemoved) return 'removed'
  return 'changed'
}

function DiffRow({
  label,
  oldValue,
  newValue,
  mode,
}: {
  label: string
  oldValue: any
  newValue: any
  mode: 'added' | 'removed' | 'changed'
}) {

  if (mode === 'added') {
    if (newValue === undefined) return null

    return (
      <div className={surfaceStyles.diffField}>
        <div className={surfaceStyles.diffLabel}>{label}</div>

        <span
          className={surfaceStyles.diffNew}
          style={{ alignSelf: 'flex-start' }}
        >
          {newValue}
        </span>
      </div>
    )
  }

  if (mode === 'removed') {
    if (oldValue === undefined) return null

    return (
      <div className={surfaceStyles.diffField}>
        <div className={surfaceStyles.diffLabel}>{label}</div>

        <span
          className={surfaceStyles.diffOldChanged}
          style={{ alignSelf: 'flex-start' }}
        >
          {oldValue}
        </span>
      </div>
    )
  }

  if (oldValue === newValue) return null

  return (
    <div className={surfaceStyles.diffField}>
      <div className={surfaceStyles.diffLabel}>{label}</div>

      <div className={surfaceStyles.diffValues}>
        <span className={surfaceStyles.diffOldChanged}>
          {oldValue ?? '—'}
        </span>

        <span className={surfaceStyles.diffArrow}>→</span>

        <span className={surfaceStyles.diffNewChanged}>
          {newValue ?? '—'}
        </span>
      </div>
    </div>
  )
}