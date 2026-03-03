import table from '@/shared/ui/table-base.module.css'
import surface from '@/shared/ui/surface.module.css'
import button from '@/shared/ui/button.module.css'
import type { PlotDto } from '@/modules/plots/types/plots.types'

interface Props {
  plots: PlotDto[]
  onDelete: (id: number) => void
  onShowMap: (plot: PlotDto) => void
  description?: string | null
}

const GRID_TEMPLATE = '1.4fr 1fr 200px'

export function PlotsTable({ plots, onDelete, onShowMap }: Props) {
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Список участков
      </h2>

      <div className={table.dataTable}>
        {/* HEADER */}
        <div
          className={table.dataHeader}
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          <span>Название</span>
          <span>Адрес</span>
          <span>Действия</span>
        </div>

        {/* ROWS */}
        {plots.map((plot) => (
          <div
            key={plot.id}
            className={table.dataRow}
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            <span data-label="Название">
              {plot.name}
            </span>

            <span data-label="Адрес">
              {plot.description ?? '—'}
            </span>

            <span
              data-label="Действия"
              style={{ display: 'flex', gap: 8 }}
            >
              <button
                type="button"
                className={`${button.btn} ${button.btnSecondary}`}
                onClick={() => onShowMap(plot)}
              >
                На карте
              </button>

              <button
                type="button"
                className={`${button.btn} ${button.btnSecondary}`}
                onClick={() => onDelete(plot.id)}
              >
                Удалить
              </button>
            </span>
          </div>
        ))}

        {!plots.length && (
          <div className={table.empty}>
            Участки отсутствуют
          </div>
        )}
      </div>
    </section>
  )
}