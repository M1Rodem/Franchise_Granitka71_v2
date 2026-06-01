import { useQuery } from '@tanstack/react-query'

import { reportsApi } from '../api/reports.api'
import { reportsKeys } from '../lib/reports.keys'
import type { ManagerFinanceQueryParams } from '../types/reports.types'

export function useManagerFinance(
  params: ManagerFinanceQueryParams | null
) {
  return useQuery({
    queryKey: params
      ? reportsKeys.managerFinance(params)
      : ['reports', 'manager-finance', 'idle'],

    queryFn: () => {
      if (!params) {
        throw new Error('Missing report params')
      }

      return reportsApi.getManagerFinanceReport(params)
    },

    enabled: Boolean(params),
  })
}