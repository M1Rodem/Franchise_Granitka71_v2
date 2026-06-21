import type {
  ManagerFinanceQueryParams,
  ManagerFinanceReportResponse,
} from '../types/reports.types'

const STORAGE_KEY = 'manager-finance-report'

export type StoredManagerFinanceReport = {
  filters: ManagerFinanceQueryParams
  report: ManagerFinanceReportResponse
}

export function saveReport(
  data: StoredManagerFinanceReport
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data)
  )
}

export function loadReport():
  | StoredManagerFinanceReport
  | null {
  const raw =
    localStorage.getItem(STORAGE_KEY)

  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}