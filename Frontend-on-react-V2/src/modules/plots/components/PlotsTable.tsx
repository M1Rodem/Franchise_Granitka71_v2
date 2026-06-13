import table from '@/shared/ui/table-base.module.css'
import button from '@/shared/ui/button.module.css'
import type { PlotDto } from '@/modules/plots/types/plots.types'
import styles from './plots-table.module.css'
import surface from '@/shared/ui/surface.module.css';

interface Props {
  plots: PlotDto[]
  onDelete: (id: number) => void
  onShowMap: (plot: PlotDto) => void
  description?: string | null
}

const GRID_TEMPLATE = '1.4fr 1fr 200px'

export function PlotsTable({ plots, onDelete, onShowMap }: Props) {
  return (
    <div className={surface.surface}>
      <div
        className={table.dataHeader}
        style={{ gridTemplateColumns: GRID_TEMPLATE }}
      >
        <span>Название</span>
        <span>Адрес</span>
        <span>Действия</span>
      </div>

      {plots.map((plot) => (
        <div
          key={plot.id}
          className={table.dataRow}
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          <span
            data-label="Участок"
            className={table.descriptionCell}
          >
            {plot.name}
          </span>

          <span
            data-label="Адрес"
            className={table.noteCell}
          >
            {plot.description?.trim() || 'Адрес не указан'}
          </span>

          <span
            data-label="Действия"
            className={styles.actionsCell}
            style={{ textAlign: 'center' }}
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
  )
}
