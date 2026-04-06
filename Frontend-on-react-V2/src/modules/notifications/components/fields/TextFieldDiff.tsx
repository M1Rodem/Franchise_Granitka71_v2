import type { FieldChangeDto } from '../../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'

interface Props {
  title: string
  items: FieldChangeDto[]
}

// НОВАЯ ФУНКЦИЯ: форматирование даты
function formatDateIfNeeded(value: string, fieldName: string): string {
  // Проверяем, является ли поле датой (по имени поля или по формату ISO)
  const isDateField = fieldName === 'OrderDate' || fieldName === 'orderDate'

  if (!isDateField) return value

  // Пробуем распарсить как дату
  const date = new Date(value)
  if (isNaN(date.getTime())) return value // не дата, возвращаем как есть

  // Форматируем в локальный формат
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date)
}

function resolveGroup(label: string): string {
  if (
    ['ФИО', 'Email', 'Телефон', 'Адрес'].includes(label)
  ) {
    return 'Клиент'
  }

  if (label === 'Покойный') {
    return 'Покойный'
  }

  if (['Монумент', 'Размер', 'Тип'].includes(label)) {
    return 'Монумент'
  }

  if (label === 'Примечание') {
    return 'Дополнительно'
  }

  // Добавляем группу для дат и других метаданных
  if (label === 'Дата заказа') {
    return 'Метаданные'
  }

  return 'Прочее'
}

function groupItems(items: FieldChangeDto[]): Record<string, FieldChangeDto[]> {
  const result: Record<string, FieldChangeDto[]> = {}

  items.forEach((item) => {
    const group = resolveGroup(item.label)

    if (!result[group]) {
      result[group] = []
    }

    result[group].push(item)
  })

  return result
}

export function TextFieldDiff({ items }: Props) {
  const normalizeValue = (value: string | null | undefined, fieldName: string): string => {
    if (value === null || value === undefined || value === '') {
      return '—'
    }
    // Форматируем дату, если нужно
    return formatDateIfNeeded(value, fieldName)
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

  const grouped = groupItems(items)

  return (
    <div className={surfaceStyles.diffList}>
      {Object.entries(grouped).map(
        ([groupName, groupItems]: [string, FieldChangeDto[]]) => (
          <div
            key={groupName}
            className={surfaceStyles.diffGroup}
            data-group={groupName}
          >
            {/* GROUP TITLE */}
            <div className={surfaceStyles.diffGroupTitle}>
              {groupName}
            </div>

            {groupItems.map((item: FieldChangeDto) => {
              const oldValue = normalizeValue(item.oldValue, item.field)
              const newValue = normalizeValue(item.newValue, item.field)

              const diffType = getDiffType(oldValue, newValue)
              const diffLabel = getDiffLabel(diffType)

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
      )}
    </div>
  )
}