import type { ManagerFinanceQueryParams } from '../types/reports.types'

export const reportsKeys = {
  all: ['reports'] as const,

  managerFinance: (
    params: ManagerFinanceQueryParams
  ) => ['reports', 'manager-finance', params] as const,
}