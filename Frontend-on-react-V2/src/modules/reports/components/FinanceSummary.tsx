import surface from '@/shared/ui/surface.module.css'

import type {
  ManagerFinanceSummaryDto,
} from '../types/reports.types'

import styles from './finance-summary.module.css'

interface FinanceSummaryProps {
  summary: ManagerFinanceSummaryDto
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('ru-RU').format(value)

export function FinanceSummary({
  summary,
}: FinanceSummaryProps) {
  return (
    <section className={surface.surface}>
        <div className={styles.header}>
            <div>
            <div className={styles.manager}>
                {summary.managerName}
            </div>

            <div className={styles.ordersCount}>
                Заказов за период: {summary.ordersCount}
            </div>
            </div>
        </div>

        <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
            <span>Продано</span>
            <strong>
                {formatMoney(summary.totalSold)} ₽
            </strong>
            </div>

            <div className={styles.kpiCard}>
            <span>Получено</span>
            <strong>
                {formatMoney(summary.totalPaid)} ₽
            </strong>
            </div>

            <div className={styles.kpiCard}>
            <span>Остаток</span>
            <strong>
                {formatMoney(summary.totalDebt)} ₽
            </strong>
            </div>

            <div className={styles.kpiCard}>
            <span>Сбор оплат</span>
            <strong>
                {summary.collectionPercent.toFixed(2)}%
            </strong>
            </div>
        </div>
        </section>
  )
}