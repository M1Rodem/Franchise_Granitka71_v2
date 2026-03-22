import type { FieldChangeDto } from '../../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'

interface Props {
  title: string
  items: FieldChangeDto[]
}

export function TextFieldDiff({ items }: Props) {
  const normalizeValue = (value: string | null | undefined): string => {
    if (value === null || value === undefined || value === '') {
      return '—'
    }
    return value
  }
  type DiffType = 'added' | 'removed' | 'changed' | 'none'

  const getDiffType = (oldVal: string, newVal: string): DiffType => {
    if (oldVal === '—' && newVal === '—') return 'none'
    if (oldVal === '—' && newVal !== '—') return 'added'
    if (oldVal !== '—' && newVal === '—') return 'removed'
    if (oldVal !== newVal) return 'changed'
    return 'none'
  }

  const getDiffLabel = (type: DiffType): string | null => {
    switch (type) {
      case 'added':
        return 'Добавлено'
      case 'removed':
        return 'Удалено'
      case 'changed':
        return 'Изменено'
      default:
        return null
    }
  }

  const getDiffClass = (type: DiffType): string => {
    switch (type) {
      case 'added':
        return surfaceStyles.diffBadgeAdded
      case 'removed':
        return surfaceStyles.diffBadgeRemoved
      case 'changed':
        return surfaceStyles.diffBadgeChanged
      default:
        return ''
    }
  }
  return (
    <div className={surfaceStyles.diffList}>
      {items.map((item) => {
        const oldValue = normalizeValue(item.oldValue)
        const newValue = normalizeValue(item.newValue)

        const diffType = getDiffType(oldValue, newValue)
        const diffLabel = getDiffLabel(diffType)

        console.log('[Notifications DEBUG] field diff', {
          field: item.field,
          oldValue,
          newValue,
          diffType,
        })

        return (
          <div key={item.field} className={surfaceStyles.diffCard}>
            {/* TITLE */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div className={surfaceStyles.diffTitle}>
                {item.label}
              </div>

              {diffLabel && (
                <span
                  className={`${surfaceStyles.diffBadge} ${getDiffClass(diffType)}`}
                >
                  {diffLabel}
                </span>
              )}
            </div>

            {/* VALUE */}
            <div className={surfaceStyles.diffField}>
              <div className={surfaceStyles.diffLabel}>
                Значение
              </div>

              <div className={surfaceStyles.diffValues}>
                <span className={surfaceStyles.diffOldChanged}>
                  <span className={surfaceStyles.hideOnDesktop}>
                    Было:{' '}
                  </span>
                  {oldValue}
                </span>

                <span className={surfaceStyles.diffArrow}>→</span>

                <span className={surfaceStyles.diffNewChanged}>
                  <span className={surfaceStyles.hideOnDesktop}>
                    Стало:{' '}
                  </span>
                  {newValue}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}