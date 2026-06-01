import { OrdersDateInput } from '@/modules/orders/components/OrdersDateInput'
import { AnimatedSelect } from '@/shared/ui/AnimatedSelect'
import button from '@/shared/ui/button.module.css'
import surface from '@/shared/ui/surface.module.css'
import styles from '@/modules/orders/components/orders-filter-bar.module.css'
import financeStyles from './finance-filters.module.css'

export type FinanceFiltersValue = {
  dateFrom: string
  dateTo: string
  managerId: number | null
}

interface FinanceFiltersProps {
  value: FinanceFiltersValue
  managers: {
    value: string
    label: string
  }[]

  isLoading: boolean

  onChange: (
    patch: Partial<FinanceFiltersValue>
  ) => void

  onSubmit: () => void
}

export function FinanceFilters({
  value,
  managers,
  isLoading,
  onChange,
  onSubmit,
}: FinanceFiltersProps) {
  return (
    <section className={surface.surface}>
        <div className={styles.form}>
        <div className={financeStyles.financeGrid}>
            <OrdersDateInput
            label="Дата от"
            isoValue={value.dateFrom}
            onCommit={(dateFrom) =>
                onChange({ dateFrom })
            }
            />

            <OrdersDateInput
            label="Дата до"
            isoValue={value.dateTo}
            onCommit={(dateTo) =>
                onChange({ dateTo })
            }
            />

            <label>
            <span>Менеджер</span>

            <AnimatedSelect
                value={
                value.managerId
                    ? String(value.managerId)
                    : ''
                }
                options={[
                {
                    value: '',
                    label: 'Выберите менеджера',
                },
                ...managers,
                ]}
                onChange={selectedValue =>
                onChange({
                    managerId: selectedValue
                    ? Number(selectedValue)
                    : null,
                })
                }
            />
            </label>

            <div
            style={{
                display: 'flex',
                alignItems: 'flex-end',
            }}
            >
            <button
                type="button"
                className={`${button.btn} ${button.btnPrimary}`}
                disabled={
                isLoading ||
                !value.managerId ||
                !value.dateFrom ||
                !value.dateTo
                }
                onClick={onSubmit}
            >
                Сформировать
            </button>
            </div>
        </div>
        </div>
    </section>
  )
}