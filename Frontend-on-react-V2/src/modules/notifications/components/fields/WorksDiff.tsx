import type { WorksChangeDto } from '../../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'

interface Props {
  data: WorksChangeDto
}

export function WorksDiff({ data }: Props) {
  const { addedWorks, removedWorks, changedWorks } = data

  const hasAdded = addedWorks?.length > 0
  const hasRemoved = removedWorks?.length > 0
  const hasChanged = changedWorks?.length > 0

  if (!hasAdded && !hasRemoved && !hasChanged) return null

  return (
    <div className={surfaceStyles.diffList}>

      {/* ИЗМЕНЕНИЯ */}
      {hasChanged && (
        <Category title="Изменения">
          {changedWorks.map((item) => (
            <WorkItem
              key={item.id}
              type="changed"
              oldWork={item.old}
              newWork={item.new}
            />
          ))}
        </Category>
      )}

      {/* ДОБАВЛЕНО */}
      {hasAdded && (
        <Category title="Добавлено">
          {addedWorks.map((item) => (
            <WorkItem
              key={`added-${item.id}-${item.workDescription}`}
              type="added"
              newWork={item}
            />
          ))}
        </Category>
      )}

      {/* УДАЛЕНО */}
      {hasRemoved && (
        <Category title="Удалено">
          {removedWorks.map((item) => (
            <WorkItem
              key={`removed-${item.id}-${item.workDescription}`}
              type="removed"
              oldWork={item}
            />
          ))}
        </Category>
      )}

    </div>
  )
}

function Category({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className={surfaceStyles.diffGroup}>
      <div className={surfaceStyles.diffGroupTitle}>
        {title}
      </div>
      {children}
    </div>
  )
}

function WorkItem({
  type,
  oldWork,
  newWork,
}: {
  type: 'added' | 'removed' | 'changed'
  oldWork?: any
  newWork?: any
}) {
  const isDistance = Boolean(
    (newWork && newWork.isDistanceWork === true) ||
    (oldWork && oldWork.isDistanceWork === true)
  )

  const normalize = (v: any) => {
    if (v === null || v === undefined) return 0
    return Number(v)
  }

  const calcDistanceTotal = (w: any) => {
    return normalize(w?.routes) * normalize(w?.distanceKm)
  }

  const calcDefaultTotal = (w: any) => {
    return normalize(w?.price) * normalize(w?.quantity)
  }

  const title =
    newWork?.workDescription ||
    oldWork?.workDescription ||
    '—'

  return (
    <div className={surfaceStyles.diffCard}>

      {/* HEADER — только заголовок и бейдж */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className={surfaceStyles.diffTitle}>{title}</div>

        {type === 'added' && (
          <span className={`${surfaceStyles.diffBadge} ${surfaceStyles.diffBadgeAdded}`}>
            Добавлено
          </span>
        )}

        {type === 'removed' && (
          <span className={`${surfaceStyles.diffBadge} ${surfaceStyles.diffBadgeRemoved}`}>
            Удалено
          </span>
        )}

        {type === 'changed' && (
          <span className={`${surfaceStyles.diffBadge} ${surfaceStyles.diffBadgeChanged}`}>
            Изменено
          </span>
        )}
      </div>

      {/* BODY — показываем изменения */}
      {isDistance ? (
        <>
          <DiffRow label="Цена за км" oldValue={oldWork?.price} newValue={newWork?.price} type={type} />

          <DiffRow label="Км за рейс"
            oldValue={normalize(oldWork?.distanceKm)}
            newValue={normalize(newWork?.distanceKm)}
            type={type}
          />

          <DiffRow label="Рейсы"
            oldValue={normalize(oldWork?.routes)}
            newValue={normalize(newWork?.routes)}
            type={type}
          />

          <DiffRow label="Итого"
            oldValue={calcDistanceTotal(oldWork)}
            newValue={calcDistanceTotal(newWork)}
            type={type}
          />
        </>
      ) : (
        <>
          <DiffRow label="Цена"
            oldValue={normalize(oldWork?.price)}
            newValue={normalize(newWork?.price)}
            type={type}
          />

          <DiffRow label="Количество"
            oldValue={normalize(oldWork?.quantity)}
            newValue={normalize(newWork?.quantity)}
            type={type}
          />

          <DiffRow label="Итого"
            oldValue={calcDefaultTotal(oldWork)}
            newValue={calcDefaultTotal(newWork)}
            type={type}
          />
        </>
      )}

      <DiffRow label="Примечание" oldValue={oldWork?.note} newValue={newWork?.note} type={type} />
    </div>
  )
}

function DiffRow({
  label,
  oldValue,
  newValue,
  type,
}: {
  label: string
  oldValue: any
  newValue: any
  type: 'added' | 'removed' | 'changed'
}) {

  if (type === 'added') {
    if (newValue === undefined) return null

    return (
      <div className={surfaceStyles.diffField}>
        <div className={surfaceStyles.diffLabel}>{label}</div>
        <span className={surfaceStyles.diffNew}>{newValue}</span>
      </div>
    )
  }

  if (type === 'removed') {
    if (oldValue === undefined) return null

    return (
      <div className={surfaceStyles.diffField}>
        <div className={surfaceStyles.diffLabel}>{label}</div>
        <span className={surfaceStyles.diffOldChanged}>{oldValue}</span>
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