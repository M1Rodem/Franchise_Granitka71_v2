import surface from '@/shared/ui/surface.module.css'
import table from '@/shared/ui/table-base.module.css'

interface WorkItem {
  id: number
  workDescription: string
  price: number

  quantity?: number

  routes?: number
  distanceKm?: number
  isDistanceWork?: boolean

  note?: string | null
}

interface Props {
  items: WorkItem[]
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const GRID = '2fr 1fr 1fr 1fr 2fr'
const DISTANCE_GRID = '2fr 1fr 1fr 1fr 1fr 1fr 2fr'

const round = (v: number) => Math.round(v * 100) / 100

export function WorksSection({ items }: Props) {

  const distance = items.find(i => i.isDistanceWork)
  const normalItems = items.filter(i => !i.isDistanceWork)

  if (!items.length) {
    return (
      <section className={surface.surface}>
        <h2 className={surface.sectionTitle}>Работы по заказу</h2>
        <div className={table.empty}>Работы отсутствуют</div>
      </section>
    )
  }

  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Работы по заказу</h2>

      {distance && (
        <div className={table.dataTable}>

          <div
            className={table.dataHeader}
            style={{ gridTemplateColumns: DISTANCE_GRID }}
          >
            <span>Описание</span>
            <span>Цена</span>
            <span>КМ</span>
            <span>Рейсы</span>
            <span>Кол-во</span>
            <span>Итого</span>
            <span>Примечание</span>
          </div>

          <div
            className={table.dataRow}
            style={{ gridTemplateColumns: DISTANCE_GRID }}
          >
            <span className={table.descriptionCell}>
              {distance.workDescription}
            </span>

            <span>
              {formatMoney(distance.price)}
            </span>

            <span>
              {round(distance.distanceKm ?? 0)}
            </span>

            <span>
              {distance.routes ?? 1}
            </span>

            <span>
              {round(
                (distance.routes ?? 1) *
                (distance.distanceKm ?? 0)
              )}
            </span>

            <span>
              {formatMoney(
                round(
                  (distance.price || 0) *
                  (distance.routes || 1) *
                  (distance.distanceKm || 0)
                )
              )}
            </span>

            <span className={table.noteCell}>
              {distance.note || '—'}
            </span>
          </div>
        </div>
      )}

      {normalItems.length > 0 && (
        <div className={table.dataTable}>

          <div
            className={table.dataHeader}
            style={{ gridTemplateColumns: GRID }}
          >
            <span>Описание</span>
            <span>Цена</span>
            <span>Кол-во</span>
            <span>Итого</span>
            <span>Примечание</span>
          </div>

          {normalItems.map((item) => {
            const total =
              round((item.price || 0) * (item.quantity || 0))

            return (
              <div
                key={item.id}
                className={table.dataRow}
                style={{ gridTemplateColumns: GRID }}
              >
                <span className={table.descriptionCell}>
                  {item.workDescription}
                </span>

                <span>
                  {formatMoney(item.price)}
                </span>

                <span>
                  {item.quantity ?? 0}
                </span>

                <span>
                  {formatMoney(total)}
                </span>

                <span className={table.noteCell}>
                  {item.note || '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}