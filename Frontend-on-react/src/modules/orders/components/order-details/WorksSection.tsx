import surface from '@/shared/ui/surface.module.css'
import table from '@/shared/ui/table-base.module.css'

interface WorkItem {
  id: number
  workDescription: string
  price: number
  quantity: number
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

const GRID_TEMPLATE = '2fr 1fr 1fr 1fr 2fr'

export function WorksSection({ items }: Props) {
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Работы по заказу</h2>

      {items.length === 0 ? (
        <div className={table.empty}>
          Работы отсутствуют
        </div>
      ) : (
        <>
          <div className={table.dataTable}>
            <div
              className={table.dataHeader}
              style={{ gridTemplateColumns: GRID_TEMPLATE }}
            >
              <span>Описание</span>
              <span>Кол-во</span>
              <span>Цена</span>
              <span>Итого</span>
              <span>Примечание</span>
            </div>

            {items.map((item) => {
              const rowTotal =
                item.price * item.quantity

              return (
                <div
                  key={item.id}
                  className={table.dataRow}
                  style={{
                    gridTemplateColumns: GRID_TEMPLATE,
                  }}
                >
                  <span
                    data-label="Описание"
                    className={table.descriptionCell}
                  >
                    {item.workDescription}
                  </span>

                  <span data-label="Кол-во">
                    {item.quantity}
                  </span>

                  <span data-label="Цена">
                    {formatMoney(item.price)}
                  </span>

                  <span data-label="Итого">
                    {formatMoney(rowTotal)}
                  </span>

                  <span
                    data-label="Примечание"
                    className={table.noteCell}
                  >
                    {item.note || '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}