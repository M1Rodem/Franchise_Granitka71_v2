import { useEffect, useState } from 'react'

import { useUiStore } from '@/shared/store/ui.store'

import { FinanceFilters } from '../components/FinanceFilters'
import { FinanceSummary } from '../components/FinanceSummary'
import { FinanceOrdersTable } from '../components/FinanceOrdersTable'

import { useManagersOptions } from '../hooks/use-managers-options'
import { useManagerFinance } from '../hooks/use-manager-finance'

import { loadReport, saveReport } from '../lib/report-storage'

import styles from './manager-finance.page.module.css'

type FiltersState = {
  dateFrom: string
  dateTo: string
  managerId: number | null
}

const today = new Date()

const defaultDateTo = today.toISOString().slice(0, 10)

const defaultDateFrom = new Date(
  today.getFullYear(),
  today.getMonth(),
  1,
)
  .toISOString()
  .slice(0, 10)

export default function ManagerFinancePage() {
  useEffect(() => {
    useUiStore.setState({
      header: {
        mode: 'managerFinance',
        title: 'Финансовая аналитика',
        submitDisabled: false,
      },
    })

    return () => {
      useUiStore.getState().resetHeader()
    }
  }, [])

  const [filters, setFilters] =
    useState<FiltersState>({
      dateFrom: defaultDateFrom,
      dateTo: defaultDateTo,
      managerId: null,
    })

  const [submittedFilters, setSubmittedFilters] =
    useState<FiltersState | null>(null)

  const managersQuery =
    useManagersOptions()

  const reportQuery =
    useManagerFinance(
      submittedFilters &&
        submittedFilters.managerId
        ? {
            dateFrom:
              submittedFilters.dateFrom,
            dateTo:
              submittedFilters.dateTo,
            managerId:
              submittedFilters.managerId,
          }
        : null
    )

    useEffect(() => {
        const stored = loadReport()

        if (!stored) {
            return
        }

        setFilters(stored.filters)
        setSubmittedFilters(stored.filters)
    }, [])

    useEffect(() => {
        if (
            reportQuery.data &&
            submittedFilters &&
            submittedFilters.managerId !== null
        ) {
            saveReport({
            filters: {
                dateFrom: submittedFilters.dateFrom,
                dateTo: submittedFilters.dateTo,
                managerId: submittedFilters.managerId,
            },
            report: reportQuery.data,
            })
        }
        }, [
        reportQuery.data,
        submittedFilters,
    ])

  return (
    <div className={styles.page}>
      <FinanceFilters
        value={filters}
        managers={
          managersQuery.data ?? []
        }
        isLoading={
          reportQuery.isFetching
        }
        onChange={patch =>
          setFilters(prev => ({
            ...prev,
            ...patch,
          }))
        }
        onSubmit={() =>
          setSubmittedFilters(filters)
        }
      />

      {submittedFilters &&
        reportQuery.isPending && (
        <div className={styles.loader}>
            Загрузка отчета...
        </div>
      )}

      {reportQuery.isError && (
        <div className={styles.error}>
          Не удалось сформировать отчет
        </div>
      )}

      {reportQuery.data && (
        <>
          <FinanceSummary
            summary={
              reportQuery.data.summary
            }
          />

          <FinanceOrdersTable
            orders={
              reportQuery.data.orders
            }
            summary={
              reportQuery.data.summary
            }
          />
        </>
      )}
    </div>
  )
}